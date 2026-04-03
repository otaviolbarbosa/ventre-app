import { MdGridOff } from "react-icons/md";

export const EmptyData = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-24 w-24 items-center justify-center rounded-full border border-amber-400 bg-amber-50 drop-shadow-md">
        <MdGridOff className="text-5xl text-amber-500 drop-shadow-md" />
      </div>
      <div className="text-sm">Sem registros encontrados</div>
    </div>
  );
};
