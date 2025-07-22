export function getRandomId(min = 1, max = 1000000): string {
  min = Math.ceil(min);
  max = Math.floor(max);
  return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
}
