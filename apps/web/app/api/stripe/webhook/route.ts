import { dayjs } from "@/lib/dayjs";
import { type Database, createServerSupabaseAdmin } from "@nascere/supabase";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const POST = async (req: Request) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Stripe webhook is not configured. Missing server environment variables." },
        { status: 500 },
      );
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing Stripe signature header." }, { status: 400 });
    }

    const text = await req.text();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      text,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    const supabaseAdmin = await createServerSupabaseAdmin();

    if (event.type === "customer.subscription.updated") {
      const stripeSubscription = event.data.object as Stripe.Subscription;

      if (stripeSubscription.cancel_at_period_end) {
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceling",
            ...(stripeSubscription.cancel_at && {
              expires_at: dayjs.unix(stripeSubscription.cancel_at).toISOString(),
            }),
            updated_at: new Date().toISOString(),
          })
          .eq("subscription_id", stripeSubscription.id);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const stripeSubscription = event.data.object as Stripe.Subscription;

      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("subscription_id", stripeSubscription.id);
    }

    if (event.type === "checkout.session.completed") {
      console.log("#1");
      const session = event.data.object;
      console.log("#2");
      const userId = session.metadata?.user_id as string | undefined;
      console.log("#3");
      const planId = session.metadata?.plan_id as string | undefined;
      console.log("#4");

      if (!userId || !planId) {
        return NextResponse.json(
          { error: "Checkout session metadata is missing user_id or plan_id." },
          { status: 400 },
        );
      }

      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (userError) {
        throw new Error(`Failed to fetch user: ${userError.message}`);
      }
      console.log("#5");
      if (!user) {
        return NextResponse.json(
          { error: "User not found for checkout session." },
          { status: 404 },
        );
      }

      const { data: plan, error: planError } = await supabaseAdmin
        .from("plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();
      if (planError) {
        throw new Error(`Failed to fetch plan: ${planError.message}`);
      }
      console.log("#6");
      if (!plan) {
        return NextResponse.json(
          { error: "Plan not found for checkout session." },
          { status: 404 },
        );
      }

      // set subscription data object
      const frequence = session.metadata
        ?.frequence as Database["public"]["Enums"]["subscription_frequence"];
      console.log("#7");

      const subscriptionId = session.subscription as string;
      console.log("#8");
      const paidAt = dayjs.unix(session.created).toISOString();
      console.log("#9");
      const expiresAt = dayjs.unix(session.expires_at).toISOString();
      console.log("#10");

      const subscriptionData: Database["public"]["Tables"]["subscriptions"]["Insert"] = {
        user_id: user.id,
        plan_id: plan.id,
        frequence: frequence,
        subscription_id: subscriptionId,
        status: session.payment_status === "paid" ? "active" : "pending",
        paid_at: paidAt,
        expires_at: expiresAt,
      };

      console.log("#11");
      console.log(subscriptionData);

      const { error: insertError } = await supabaseAdmin
        .from("subscriptions")
        .insert(subscriptionData);
      if (insertError) {
        throw new Error(`Failed to save subscription: ${insertError.message}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown webhook error";
    console.error("Stripe webhook error:", errorMessage);

    const statusCode = error instanceof Stripe.errors.StripeSignatureVerificationError ? 400 : 500;

    return NextResponse.json(
      { error: `Failed to process webhook: ${errorMessage}` },
      { status: statusCode },
    );
  }
};
