import { FileSystem } from "../main/deno.js"


const mainInfo = await FileSystem.info("./main")
console.debug(`mainInfo is:`,mainInfo)
const brokenLinkInfo = await FileSystem.info("commands/tools/settings.ignore")
console.debug(`brokenLinkInfo is:`,brokenLinkInfo)
const finalTargetBrokenLink = await FileSystem.finalTargetOf("commands/tools/settings.ignore")
console.debug(`finalTargetBrokenLink is:`,finalTargetBrokenLink)