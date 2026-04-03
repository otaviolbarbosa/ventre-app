import type { Model } from "../../types";

export type DataTableAction<T extends Model> = ((model: T) => React.ReactNode) | "edit" | "delete";

export type DataTableColumn<T extends Model> = {
  label: string;
  name: keyof T;
  property?: string;
  callback?: (model: T) => React.ReactNode;
};

export type DataTableProps<T extends Model> = {
  data: T[];
  totalPages: number;
  options: {
    modelName: string;
    columns?: DataTableColumn<T>[];
    actions?: DataTableAction<T>[];
    path: string;
    fieldsToSearch: string[];
  };
  fetchData: (page: number, size: number, order?: { field: string; isAscendent: boolean }) => void;
  onAction?: (action: DataTableAction<T>, model: T) => void;
  onDeleteAction?: (id: string) => void;
};

export type DataItemProps<T extends Model> = {
  item: T;
  columns?: DataTableColumn<T>[];
  actions?: DataTableAction<T>[];
  path: string;
  onDeleteAction?: (id: string) => void;
};
