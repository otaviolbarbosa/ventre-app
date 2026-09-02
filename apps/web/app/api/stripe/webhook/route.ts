import { dayjs } from "@/lib/dayjs";
import { resolveCheckoutSource } from "@/lib/webhook-checkout-source";
import { type Database, createServerSupabaseAdmin } from "@ventre/supabase";
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

    const rawBody = await req.arrayBuffer();
    const body = Buffer.from(rawBody);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      body,
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
      const session = event.data.object;

      let paymentLinkPlan: { planId: string; frequence: string } | null = null;
      if (session.payment_link) {
        const paymentLinkId =
          typeof session.payment_link === "string" ? session.payment_link : session.payment_link.id;

        // biome-ignore lint/suspicious/noExplicitAny: stripe_payment_link table not yet in generated types — run pnpm db:types to fix
        const { data: linkRow, error: linkError } = await (supabaseAdmin as any)
          .from("stripe_payment_link")
          .select("plan_id, frequence")
          .eq("stripe_payment_link_id", paymentLinkId)
          .maybeSingle();

        if (linkError) throw new Error(`Failed to fetch payment link: ${linkError.message}`);
        if (linkRow) paymentLinkPlan = { planId: linkRow.plan_id, frequence: linkRow.frequence };
      }

      const resolved = resolveCheckoutSource({
        metadata: {
          user_id: session.metadata?.user_id,
          enterprise_id: session.metadata?.enterprise_id,
          plan_id: session.metadata?.plan_id,
          frequence: session.metadata?.frequence,
        },
        clientReferenceId: session.client_reference_id,
        paymentLinkPlan,
      });

      if (!resolved) {
        return NextResponse.json(
          { error: "Checkout session metadata is missing plan_id or frequence." },
          { status: 400 },
        );
      }

      const { data: plan, error: planError } = await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("id", resolved.planId)
        .maybeSingle();
      if (planError) throw new Error(`Failed to fetch plan: ${planError.message}`);
      if (!plan) {
        return NextResponse.json(
          { error: "Plan not found for checkout session." },
          { status: 404 },
        );
      }

      const subscriptionId = session.subscription as string;
      const paidAt = dayjs.unix(session.created).toISOString();

      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      const firstItem = stripeSubscription.items.data[0];

      if (!firstItem) throw new Error("Subscription has no items");

      const expiresAt = dayjs.unix(firstItem.current_period_end).toISOString();
      const status = session.payment_status === "paid" ? "active" : "pending";

      const { data: existingSubscription, error: existingSubscriptionError } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("subscription_id", subscriptionId)
        .maybeSingle();
      if (existingSubscriptionError)
        throw new Error(`Failed to check existing subscription: ${existingSubscriptionError.message}`);
      const isNewSubscription = !existingSubscription;

      if (resolved.enterpriseId) {
        await handleEnterpriseSubscription({
          supabaseAdmin,
          enterpriseId: resolved.enterpriseId,
          planId: plan.id,
          frequence: resolved.frequence as SubscriptionFrequence,
          subscriptionId,
          status,
          paidAt,
          expiresAt,
        });
      } else if (resolved.userId) {
        await handleIndividualSubscription({
          supabaseAdmin,
          userId: resolved.userId,
          planId: plan.id,
          frequence: resolved.frequence as SubscriptionFrequence,
          subscriptionId,
          status,
          paidAt,
          expiresAt,
        });
      } else {
        return NextResponse.json(
          { error: "Checkout session metadata is missing enterprise_id or user_id." },
          { status: 400 },
        );
      }

      if (paymentLinkPlan && session.payment_link && isNewSubscription) {
        const paymentLinkId =
          typeof session.payment_link === "string" ? session.payment_link : session.payment_link.id;

        // biome-ignore lint/suspicious/noExplicitAny: stripe_payment_link table not yet in generated types — run pnpm db:types to fix
        const { data: linkRow, error: linkLookupError } = await (supabaseAdmin as any)
          .from("stripe_payment_link")
          .select("id")
          .eq("stripe_payment_link_id", paymentLinkId)
          .maybeSingle();
        if (linkLookupError)
          throw new Error(`Failed to look up payment link for usage sync: ${linkLookupError.message}`);

        if (linkRow) {
          // biome-ignore lint/suspicious/noExplicitAny: increment_payment_link_usage RPC not yet in generated types — run pnpm db:types to fix
          const { error: incrementError } = await (supabaseAdmin as any).rpc(
            "increment_payment_link_usage",
            { p_payment_link_id: linkRow.id },
          );
          if (incrementError)
            throw new Error(`Failed to increment payment link usage: ${incrementError.message}`);
        }
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

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;
type SubscriptionFrequence = Database["public"]["Enums"]["subscription_frequence"];
type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

async function handleEnterpriseSubscription({
  supabaseAdmin,
  enterpriseId,
  planId,
  frequence,
  subscriptionId,
  status,
  paidAt,
  expiresAt,
}: {
  supabaseAdmin: SupabaseAdmin;
  enterpriseId: string;
  planId: string;
  frequence: SubscriptionFrequence;
  subscriptionId: string;
  status: SubscriptionStatus;
  paidAt: string;
  expiresAt: string;
}) {
  const { data: enterprise, error: enterpriseError } = await supabaseAdmin
    .from("enterprises")
    .select("id")
    .eq("id", enterpriseId)
    .maybeSingle();
  if (enterpriseError) throw new Error(`Failed to fetch enterprise: ${enterpriseError.message}`);
  if (!enterprise) throw new Error(`Enterprise not found: ${enterpriseId}`);

  // Replace any existing active subscription for this enterprise
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "replaced", updated_at: new Date().toISOString() })
    .eq("enterprise_id", enterpriseId)
    .in("status", ["active", "pending"]);

  const { error: insertError } = await supabaseAdmin.from("subscriptions").upsert(
    {
      enterprise_id: enterpriseId,
      user_id: null,
      plan_id: planId,
      frequence,
      subscription_id: subscriptionId,
      status,
      paid_at: paidAt,
      expires_at: expiresAt,
    },
    { onConflict: "subscription_id" },
  );

  if (insertError)
    throw new Error(`Failed to save enterprise subscription: ${insertError.message}`);
}

async function handleIndividualSubscription({
  supabaseAdmin,
  userId,
  planId,
  frequence,
  subscriptionId,
  status,
  paidAt,
  expiresAt,
}: {
  supabaseAdmin: SupabaseAdmin;
  userId: string;
  planId: string;
  frequence: SubscriptionFrequence;
  subscriptionId: string;
  status: SubscriptionStatus;
  paidAt: string;
  expiresAt: string;
}) {
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (userError) throw new Error(`Failed to fetch user: ${userError.message}`);
  if (!user) throw new Error(`User not found: ${userId}`);

  // Replace any existing active subscription for this user
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "replaced", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("status", ["active", "pending"]);

  const { error: insertError } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      frequence,
      subscription_id: subscriptionId,
      status,
      paid_at: paidAt,
      expires_at: expiresAt,
    },
    { onConflict: "subscription_id" },
  );
  if (insertError) throw new Error(`Failed to save subscription: ${insertError.message}`);
}
