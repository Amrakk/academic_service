export function generateRandomCode(length: number): string {
    let result = "";

    for (let i = 0; i < length; i++) {
        result += String.fromCharCode(Math.floor(Math.random() * 26) + 65);
    }

    return result;
}
