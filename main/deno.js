
const Path = await import("https://deno.land/std@0.117.0/path/mod.ts")
const { copy } = await import("https://deno.land/std@0.123.0/streams/conversion.ts")
const { console: vibrantConsole, vibrance } = (await import('https://cdn.skypack.dev/vibrance@v0.1.27')).default

delete vibrantConsole.howdy

const ansiRegexPattern = new RegExp(
    [
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
    ].join('|'),
    'g'
)

const Console = {
    ...vibrantConsole,
    env: new Proxy({}, {
        // Object.keys
        ownKeys(target) {
            return Object.keys(Deno.env.toObject())
        },
        has(original, key) {
            return Deno.env.get(key) !== undefined
        },
        get(original, key) {
            return Deno.env.get(key)
        },
        set(original, key, value) {
            return Deno.env.set(key, value)
        },
        deleteProperty(original, key) {
            return Deno.env.delete(key)
        },
    }),
    tui: {
        wordWrap({string, width, padEnd=""}) {
            return string.split("\n").map(each=>{
                const peices = []
                while (true) {
                    var [ firstPart, each ] = [ each.slice(0, width), each.slice(width) ]
                    if (firstPart.length) {
                        if (padEnd) {
                            const additionalLength = firstPart.length - firstPart.replace(ansiRegexPattern, "").length
                            firstPart = firstPart.padEnd(width+additionalLength, padEnd)
                        }
                        peices.push(firstPart)
                    } else {
                        break
                    }
                }
                if (peices.length == 0) {
                    return [" ".padEnd(width, padEnd) ]
                } else {
                    return peices
                }
            }).flat()
        },
    },
    explain: {
        error({ title, body, suggestions=[], width=90 }) {
            const [startTitleLine, endTitleLine] = [ " |   ", "   | " ]
            const titlePadding = startTitleLine.length + endTitleLine.length
            const [startBodyLine, endBodyLine] = [ " |     ", "     | " ]
            const bodyPadding = startBodyLine.length + endBodyLine.length
            const suggestionPadding = 16
            // TODO: give error if width too small
            const addBarsToTitle       = (string)=>vibrance.bgBlack.redBright(`${startTitleLine}${vibrance.bgBlack.redBright.bold(string)}${endTitleLine}`)
            const addBarsToBody        = (string)=>vibrance.bgBlack.redBright(startBodyLine).bgBlack.white(string).bgBlack.redBright(endBodyLine)
            const addBarsToSuggestions = (string)=>vibrance.bgBlack.redBright(startBodyLine).bgBlack.white(string).bgBlack.redBright(endBodyLine)
            const wrappedTile = Console.tui.wordWrap({ string: title, width: width - titlePadding, padEnd:" " }).map(addBarsToTitle).join("\n")
            const wrappedBody = Console.tui.wordWrap({ string: body, width: width - bodyPadding , padEnd:" " }).map(addBarsToBody).join("\n")
            const wrappedSuggestions = suggestions.map( // word wrap each suggestion independently (list of lists)
                    each=>(
                        Console.tui.wordWrap({ string: each, width: width - suggestionPadding, padEnd: " " })
                    )
                ).map( // put "- " on the first line and "  " on the rest for each individual suggestion
                    ([firstLine, ...otherLines])=>(
                        [ `- ${firstLine}`, ...otherLines.map(each=>`  ${each}`) ].map(addBarsToSuggestions).join("\n")
                    )
                )
            const top             = vibrance.bgBlack.redBright( ` ${`_`.repeat(width-2)} ` )
            const bottom          = vibrance.bgBlack.redBright( ` ${`-`.repeat(width-2)} ` )
            const blank           = vibrance.bgBlack.redBright(` |${` `.repeat(width-4)}| `)
            const suggestionsLine = vibrance.bgBlack.redBright(startTitleLine).bgBlack.yellow(`Suggestions:`.padEnd(width - titlePadding)).bgBlack.redBright(endTitleLine)
            console.log(
                [
                    "",
                    top,
                    blank,
                    wrappedTile,
                    blank,
                    wrappedBody,
                    ...(wrappedSuggestions && [ blank, suggestionsLine, ...wrappedSuggestions ]),
                    blank,
                    bottom,
                ].join("\n"),
            )
        },
    }
    // getExecutable() {return Deno.execPath()}
}

export const FileSystem = {
    getCwd() {
        return Deno.cwd()
    },
    __filename__() {
        const err = new Error()
        // element 0 is "Error", element 1 is the path to this file, element 2 should be the path to the caller
        const pathToCaller = err.stack.split(/\n    at ([\w\W]*?)(?::\d+:\d+|$)/g)[2]
        
        // if valid file
        // FIXME: make sure this works inside of anonymous functions (not sure if error stack handles that well)
        if (Deno.lstatSync(pathToCaller).isFile) {
            return pathToCaller
        // if in an interpreter 
        } else {
            return null
        }
    },
    __dirname__() {
        const err = new Error()
        // element 0 is "Error", element 1 is the path to this file, element 2 should be the path to the caller
        const pathToCaller = err.stack.split(/\n    at ([\w\W]*?)(?::\d+:\d+|$)/g)[2]
        
        // if valid file
        // FIXME: make sure this works inside of anonymous functions (not sure if error stack handles that well)
        if (Deno.lstatSync(pathToCaller).isFile) {
            return Path.dirname(pathToCaller)
        // if in an interpreter 
        } else {
            return Deno.cwd()
        }
    },
    read: async (filePath) => {
        try {
            return await Deno.readTextFile(file)
        } catch (error) {
            return null
        }
    },
    info: async (fileOrFolder) => {
        const result1 = await Deno.lstat(fileOrFolder).catch(()=>({doesntExist: true}))
        result1.exists = !result1.doesntExist
        if (result1.exists) {
            const result2 = await Deno.stat(fileOrFolder).catch(()=>({doesntExist: true}))
            result1.isFile = result2.isFile
            result1.isDirectory = result2.isDirectory
        }
        return result1
    },
    remove: (fileOrFolder) => Deno.remove(path,{recursive: true}).catch(()=>false),
    makeAbsolute: (path)=> {
        if (!Path.isAbsolute(path)) {
            return Path.normalize(Path.join(Deno.cwd(), path))
        } else {
            return path
        }
    },
    clearAPathFor: async (path)=>{
        const parentPath = Path.dirname(path)
        // dont need to clear a path for the root folder
        if (parentPath == path) {
            return
        } else {
            // we do need to clear a path for the parent of this folder
            await FileSystem.clearAPathFor(parentPath)
        }
        const { exists, isDirectory } = await FileSystem.info(parentPath)
        // if a folder is in the way, delete it
        if (exists && !isDirectory) {
            await FileSystem.remove(parentPath)
        }
        const parentPathInfo = await Deno.lstat(parentPath).catch(()=>({doesntExist: true}))
        // if no folder was there, create one
        if (!parentPathInfo.exists) {
            Deno.mkdir(Path.dirname(parentPath),{ recursive: true })
        }
    },
    walkUpUntil: async (fileToFind, startPath=null)=> {
        const cwd = Deno.cwd()
        let here = startPath || cwd
        if (!Path.isAbsolute(here)) {
            here = Path.join(cwd, fileToFind)
        }
        while (1) {
            let checkPath = Path.join(here, fileToFind)
            const pathInfo = await Deno.stat(checkPath).catch(()=>({doesntExist: true}))
            if (!pathInfo.doesntExist) {
                return checkPath
            }
            // reached the top
            if (here == Path.dirname(here)) {
                return null
            } else {
                // go up a folder
                here =  Path.dirname(here)
            }
        }
    },
    copy: async ({from, to, force=true}) => {
        await FileSystem.clearAPathFor(to)
        if (force) {
            FileSystem.remove(to)
        }
        const source = await Deno.open(from, { read: true })
        const target = await Deno.create(to)
        result = await copy(source, target)
        Deno.close(source.rid)
        Deno.close(target.rid)
        return result
    },
    relativeLink: async ({existingItem, newItem}) => {
        const cwd = Deno.cwd()
        existingItem = Deno.relative(Deno.cwd(), Path.normalize(existingItem))
        newItem = Deno.relative(Deno.cwd(), Path.normalize(newItem))
        const existingItemDoesntExist = (await Deno.stat(parentPath).catch(()=>({doesntExist: true}))).doesntExist
        // if the item doesnt exists
        if (existingItemDoesntExist) {
            // FIXME: cause an error
        } else {
            await FileSystem.clearAPathFor(newItem)
            await FileSystem.remove(newItem)
        }
        return Deno.symlink(existingItem, newItem)
    },
    listPaths: async (path, options)=> {
        const results = []
        for await (const dirEntry of Deno.readDir(path)) {
            const eachPath = Path.join(path, dirEntry.name)
            results.push(eachPath)
        }
        return results
    },
    recursiveFileList: async (path, options)=> {
        if (!options.alreadySeached) {
            options.alreadySeached = new Set()
        }
        // avoid infinite loops
        if (alreadySeached.has(path)) {
            return []
        }
        const absolutePathVersion = FileSystem.makeAbsolute(path)
        alreadySeached.add(absolutePathVersion)
        const results = []
        for await (const dirEntry of Deno.readDir(path)) {
            const eachPath = Path.join(path, dirEntry.name)
            if (dirEntry.isFile) {
                results.push(eachPath)
            } else if (dirEntry.isDirectory) {
                for (const each of await FileSystem.recursiveFileList(eachPath, {...options, alreadySeached})) {
                    results.push(each)
                }
            } else if (!options.onlyHardlinks && dirEntry.isSymlink) {
                if (options.dontFollowSymlinks) {
                    results.push(eachPath)
                } else {
                    const pathInfo = await Deno.stat(eachPath).catch(()=>({doesntExist: true}))
                    if (pathInfo.isDirectory) {
                        for (const each of await FileSystem.recursiveFileList(eachPath, {...options, alreadySeached})) {
                            results.push(each)
                        }
                    } else {
                        results.push(eachPath)
                    }
                }
            }
        }
        return results
    },
}

export default {
    Console,
    FileSystem,    
}

// const FileSystem = {
//     dirname: Path.dirname,
//     basename: Path.basename,
//     extname: Path.extname,
//     join: Path.join,
//     itemInfo: (path)=>Deno.lstat(path).then((result)=>({...result, exists: true})).catch(()=>({ isFile: false, isDirectory: false, isSymlink: false, exists: false })),
//     isAbsolutePath: Path.isAbsolute,
//     isRelativePath: (...args)=>!Path.isAbsolute(...args),
//     makeAbsolutePath: Path.resolve,
//     makeRelativePath: ({from, to}) => Path.relative(from, to),
//     normalizePath: Path.normalize,
//     pathPieces: (path)=>{
//         // const [ *folders, fileName, fileExtension ] = FileSystem.pathPieces(path)
//         const result = Path.parse(path)
//         const folderList = []
//         let dirname = result.dir
//         while (true) {
//             folderList.push(dirname)
//             // if at the top 
//             if (dirname == result.root) {
//                 break
//             }
//             dirname = Path.dirname(dirname)
//         }
//         return [...folderList, result.name, result.ext ]
//     },
//     exists: (path)=>Deno.lstat(path).then(()=>true).catch(()=>false),
//     isFile: (path)=>Deno.lstat(path).then((value)=>value.isFile).catch(()=>false),
//     isFolder: (path)=>Deno.lstat(path).then((value)=>value.isDirectory).catch(()=>false),
//     isSymlink: (path)=>Deno.lstat(path).then((value)=>value.isSymlink).catch(()=>false),
//     unlink: (path)=>{
//         if (await FileSystem.isSymlink(path)) {
//             return Deno.remove(path)
//         } else if (FileSystem.exists(path)) {
//             throw Error(`Can't FileSystem.unlink('${path}') because ${path} isn't a system link.\n${JSON.stringify(FileSystem.itemInfo(path))}`)
//         }
//     },
//     // delete does not follow symlinks, just fyi
//     delete: (path)=>Deno.remove(path,{recursive: true}).catch(()=>false),
//     createFolder: (path)=>FileSystem.delete(path).then(()=>Deno.mkdir(path,{ recursive: true })),
//     ensureParentFolder: (path)=>{
//         const parentPath = Path.dirname(path)
//         const result1 = await Deno.lstat(parentPath).catch(()=>({doesntExist: true}))
//         // if something is in the way, delete it
//         if (!result1.doesntExist && !result1.isDirectory) {
//             await FileSystem.delete(parentPath)
//         }
//         const result2 = await Deno.lstat(parentPath).catch(()=>({doesntExist: true}))
//         // if no folder was there, create one
//         if (result2.doesntExist) {
//             Deno.mkdir(Path.dirname(parentPath),{ recursive: true })
//         }
//     },
//     createFile: (path)=>FileSystem.delete(path).then(()=>FileSystem.ensureParentFolder(path)).then(()=>Deno.writeTextFile(path, "")),
//     listItems: (path)=>{
//         const paths = []
//         for await (const fileOrFolder of Deno.readDir(path)) {
//             paths.push(Path.join(path,fileOrFolder.name))
//         }
//         return paths
//     },
//     // includes symlinks to files and pipes
//     listFiles: (path)=>{
//         const paths = []
//         for await (const fileOrFolder of Deno.readDir(path)) {
//             const eachPath = Path.join(path,fileOrFolder.name)
//             if (!((await Deno.lstat(eachPath)).isDirectory)) {
//                 paths.push(eachPath)
//             }
//         }
//         return paths
//     },
//     listFolders: (path)=>{
//         const paths = []
//         for await (const fileOrFolder of Deno.readDir(path)) {
//             const eachPath = Path.join(path,fileOrFolder.name)
//             if (await Deno.lstat(eachPath).isDirectory) {
//                 paths.push(eachPath)
//             }
//         }
//         return paths
//     },
//     read: (path)=>{
//         if (FileSystem.isFile(path)) {
//             return Deno.readTextFile(path)
//         }
//     },
//     targetOf: Deno.realPath,
//     write: ({data, to})=> FileSystem.delete(to).then(()=>FileSystem.ensureParentFolder(to)).then(()=>Deno.writeTextFile(to, data)),
//     // copy
//     // move
//     // rename
//     // merge
//     // setPermissions
//     // setOwner
//     // size
//     // timeCreated
//     // timeOfLastAccess
//     // timeOfLastModification
//     // absoluteLink({from, to})
//     // relativeLink({from, to})
//     // home
//     // username
//     // tempfile
//     // tempfolder
//     // readBytes
//     // append
// }