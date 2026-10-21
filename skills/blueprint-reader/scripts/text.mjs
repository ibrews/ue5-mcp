const encoder = new TextEncoder();
export const utf8 = text => encoder.encode(text);
export const byteLength = text => utf8(text).byteLength;
