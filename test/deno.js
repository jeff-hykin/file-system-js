import { FileSystem } from "../main/deno.js"

var output = await FileSystem.listFileItemsIn("./main")
console.debug(`output is:`,output)
console.debug(`output is:`,output[0].toJSON())
var output = await FileSystem.listItemsIn("./main")
console.debug(`output is:`,output)
var mainInfo = await FileSystem.info("./main")
console.debug(`mainInfo is:`,mainInfo)
var brokenLinkInfo = await FileSystem.info("commands/tools/settings.ignore")
console.debug(`brokenLinkInfo is:`,brokenLinkInfo)
var finalTargetBrokenLink = await FileSystem.finalTargetPathOf("commands/tools/settings.ignore")
console.debug(`finalTargetBrokenLink is:`,finalTargetBrokenLink)