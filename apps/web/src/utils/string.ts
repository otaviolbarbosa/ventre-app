const frequenceList = {
  month: "Mensal",
  trimester: "Trimestral",
  semester: "Semestral",
  year: "Anual",
};

export const getInitials = (name?: string) => {
  const names = name?.replace(/[^\p{L}\s]/gu, "").split(" ");

  if (!names || names.length === 0) {
    return "";
  }

  const initials =
    names.length === 1
      ? names[0]?.charAt(0).toUpperCase()
      : `${names[0]?.charAt(0)}${names[names.length - 1]?.charAt(0)}`.toUpperCase();

  return initials;
};

export const getFirstName = (name: string) => name.split(" ")?.[0] ?? "";

export const formattedFrequence = (frequence: keyof typeof frequenceList) => {
  return frequenceList[frequence];
};
