function trimString(stringToTrim: string) {
    let sliceBeginIndex = 0
    let sliceEndIndex = 0

    for (let i = 0; i < stringToTrim.length; i++) {
        if (stringToTrim.charAt(i) != " " && stringToTrim.charCodeAt(i) != 13 && stringToTrim.charCodeAt(i) != 10) {
            sliceBeginIndex = i
            break
        }
    }
    for (let j = stringToTrim.length; j >= 0; j--) {
        if (stringToTrim.charAt(j-1) != " " && stringToTrim.charCodeAt(j-1) != 13 && stringToTrim.charCodeAt(j-1) != 10) {
            sliceEndIndex = j
            break
        }
    }
    return stringToTrim.slice(sliceBeginIndex, sliceEndIndex)
}
