export const getInitials = (name?: string) => {
  const names = name?.split(" ");

  if (!names || names.length === 0) {
    return "";
  }

  const initials =
    names.length === 1
      ? names[0]?.charAt(0)
      : `${names[0]?.charAt(0)} ${names[names.length - 1]?.charAt(0)} `;

  return initials;
};
