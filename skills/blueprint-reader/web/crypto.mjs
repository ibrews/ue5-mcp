// UEBlueprint's GuidEntity treats the absence of window as Node, including in a
// browser worker. Its only crypto operation is getRandomValues. Use the native
// worker API rather than leaving a bare import('crypto') in the browser bundle.
export default globalThis.crypto;
