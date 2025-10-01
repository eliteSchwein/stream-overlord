export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
export function getRandomInt(max: number) {
  return Math.floor(Math.random() * max)
}
export function isLocalhost() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1'
}
