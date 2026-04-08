import { Loading } from "../loading";
import type { LoadingDataProps } from "./types";

export const LoadingData = ({ display }: LoadingDataProps) => {
  if (!display) return null;

  return (
    <div className="absolute top-0 flex h-full w-full flex-1 flex-col items-center justify-center bg-white/70">
      <Loading />
    </div>
  );
};
