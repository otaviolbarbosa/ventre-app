import { buildSignatureLocalityLine } from "@/lib/contract-signature-text";

const na = "[não informado]";

export function ContractSignaturePreview({
  city,
  state,
  contratanteName,
  contratadaName,
}: {
  city: string | null;
  state: string | null;
  contratanteName: string | null;
  contratadaName: string | null;
}) {
  const localityLine = buildSignatureLocalityLine(city, state, new Date());

  return (
    <div className="mt-8">
      <p className="text-center text-sm">{localityLine}</p>

      <div className="mt-8 flex justify-between gap-8">
        <div className="flex flex-1 flex-col items-center">
          <div className="relative h-[79px] w-[220px]">
            <img
              src="/images/digital-signature-stamp.png"
              alt=""
              className="h-full w-full object-contain"
            />
            <div className="absolute inset-y-0 right-2 left-[34%] flex flex-col justify-center">
              <p className="text-[6px] text-gray-700 leading-tight">
                Assinado eletronicamente por [nome do profissional]
              </p>
              <p className="text-[6px] text-gray-700 leading-tight">[data e hora da assinatura]</p>
              <p className="text-[6px] text-gray-700 leading-tight">
                Código de verificação: [código]
              </p>
              <p className="text-[6px] text-gray-700 leading-tight">[link de verificação]</p>
            </div>
          </div>
          <div className="mt-2 w-full border-black border-t" />
          <p className="mt-1 text-sm">{contratadaName ?? na}</p>
          <p className="text-gray-500 text-xs">CONTRATADA</p>
        </div>

        <div className="flex flex-1 flex-col items-center">
          <div className="h-[79px] w-[220px]" />
          <div className="mt-2 w-full border-black border-t" />
          <p className="mt-1 text-sm">{contratanteName ?? na}</p>
          <p className="text-gray-500 text-xs">CONTRATANTE</p>
        </div>
      </div>
    </div>
  );
}
