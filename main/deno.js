
const Path = await import("https://deno.land/std@0.117.0/path/mod.ts")
const { copy } = await import("https://deno.land/std@0.123.0/streams/conversion.ts")
const { vibrance } = (await import('https://cdn.skypack.dev/vibrance@v0.1.33')).default
const run = await import(`https://deno.land/x/sprinter@0.2.2/index.js`)

// TODO:
    // export an OS object
    // grab stuff from fs module: import { expandGlob } from "https://deno.land/std@0.126.0/fs/mod.ts";
        // LF vs CRLF detection
// BIG:
    // add move command
    // add copy command (figure out how to handle symlinks)


const ansiRegexPattern = new RegExp(
    [
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
    ].join('|'),
    'g'
)

export const Console = {
    ...console,
    ...vibrance,
    get osInfo() {
        return {
            kernel: {
                commonName: Deno.build.os,
            }
        }
    },
   
    get thisExecutable() {
        return Deno.execPath()
    },
    run,
    askFor: {
        line(question) {
            return prompt(question)
        },
        confirmation(question) {
            console.log(question)
            prompt("[use CTRL+C to quit, or press enter to continue]")
        },
        yesNo(question) {
            while (true) {
                let answer = prompt(question)
                const match = `${answer}`.match(/^ *(y|yes|n|no) *\n?$/i)
                if (match) {
                    // if yes
                    if (match[1][0] == 'y' || match[1][0] == 'Y') {
                        return true
                    } else {
                        return false
                    }
                } else {
                    console.log("[ please respond with y/n, yes/no, or use CTRL+C to cancel ]")
                }
            }
        },
    },
    env: new Proxy({}, {
        // Object.keys
        ownKeys(target) {
            return Object.keys(Deno.env.toObject())
        },
        has(original, key) {
            if (typeof key === 'symbol') {
                return false
            } else {
                return Deno.env.get(key) !== undefined
            }
        },
        get(original, key) {
            if (typeof key === 'symbol') {
                return undefined
            } else {
                return Deno.env.get(key)
            }
        },
        set(original, key, value) {
            if (typeof key === 'symbol') {
                return undefined
            } else {
                return Deno.env.set(key, value)
            }
        },
        deleteProperty(original, key) {
            if (typeof key === 'symbol') {
                return undefined
            } else {
                return Deno.env.delete(key)
            }
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
    },
}

class ItemInfo {
    constructor({path,_lstatData,_statData}) {
        this.path = path
        // expects doesntExist, path,
        this._lstat = _lstatData
        this._data = _statData
    }

    // 
    // core data sources
    // 
    refresh() {
        this._lstat = null
        this._data = null
    }
    get lstat() {
        if (this._lstat) {
            try {
                this._lstat = Deno.lstatSync(this.path)
            } catch (error) {
                this._lstat = {doesntExist: true}
            }
        }
        return this._lstat
    }
    get stat() {
        // compute if not cached
        if (!this._stat) {
            const lstat = this.lstat
            if (!lstat.isSymlink) {
                this._stat = {
                    isBrokenLink: false,
                    isLoopOfLinks: false,
                }
            // if symlink
            } else {
                try {
                    this._stat = Deno.statSync(this.path)
                } catch (error) {
                    if (error.message.match(/^Too many levels of symbolic links/)) {
                        this._stat.isBrokenLink = true
                        this._stat.isLoopOfLinks = true
                    } else if (error.message.match(/^No such file or directory/)) {
                        this._stat.isBrokenLink = true
                    } else {
                        // probably a permission error
                        // TODO: improve how this is handled
                        throw error
                    }
                }
            }
        }
        return this._stat
    }

    // 
    // main attributes
    // 
    get exists() {
        const lstat = this.lstat
        return !lstat.doesntExist
    }
    get name() {
        return Path.parse(this.path).name
    }
    get extension() {
        return Path.parse(this.path).ext
    }
    get basename() {
        return this.path && Path.basename(this.path)
    }
    get parentPath() {
        return this.path && Path.dirname(this.path)
    }
    relativePathFrom(parentPath) {
        return Path.relative(parentPath, this.path)
    }
    get pathToNextTarget() {
        const lstat = this.lstat
        if (lstat.isSymlink) {
            return Deno.readLinkSync(this.path)
        } else {
            return this.path
        }
    }
    get nextTarget() {
        const lstat = this.lstat
        if (lstat.isSymlink) {
            return new ItemInfo({path:Deno.readLinkSync(this.path)})
        } else {
            return this
        }
    }
    get isSymlink() {
        const lstat = this.lstat
        return !!lstat.isSymlink
    }
    get isBrokenLink() {
        const stat = this.stat
        return !!stat.isBrokenLink
    }
    get isLoopOfLinks() {
        const stat = this.stat
        return !!stat.isLoopOfLinks
    }
    get isFile() {
        const lstat = this.lstat
        // if doesnt exist then its not a file!
        if (lstat.doesntExist) {
            return false
        }
        // if hardlink
        if (!lstat.isSymlink) {
            return lstat.isFile
        }
        
        // if symlink
        const stat = this.stat
        return !!stat.isFile
    }
    get isFolder() {
        const lstat = this.lstat
        // if doesnt exist then its not a folder!
        if (lstat.doesntExist) {
            return false
        }
        // if hardlink
        if (!lstat.isSymlink) {
            return lstat.isDirectory
        }
        
        // if symlink
        const stat = this.stat
        return !!stat.isDirectory
    }
    get sizeInBytes() {
        const lstat = this.lstat
        return lstat.size
    }
    get permissions() {
        const {mode} = this.lstat
        // see: https://stackoverflow.com/questions/15055634/understanding-and-decoding-the-file-mode-value-from-stat-function-output#15059931
        return {
            owner: {        //          rwxrwxrwx
                canRead:    !!(0b0000000100000000 & mode),
                canWrite:   !!(0b0000000010000000 & mode),
                canExecute: !!(0b0000000001000000 & mode),
            },
            group: {
                canRead:    !!(0b0000000000100000 & mode),
                canWrite:   !!(0b0000000000010000 & mode),
                canExecute: !!(0b0000000000001000 & mode),
            },
            others: {
                canRead:    !!(0b0000000000000100 & mode),
                canWrite:   !!(0b0000000000000010 & mode),
                canExecute: !!(0b0000000000000001 & mode),
            },
        }
    }
    
    // aliases
    get isDirectory() { return this.isFolder }
    get dirname()     { return this.parentPath }

    toJSON() {
        return {
            exists: this.exists,
            name: this.name,
            extension: this.extension,
            basename: this.basename,
            parentPath: this.parentPath,
            pathToNextTarget: this.pathToNextTarget,
            isSymlink: this.isSymlink,
            isBrokenLink: this.isBrokenLink,
            isLoopOfLinks: this.isLoopOfLinks,
            isFile: this.isFile,
            isFolder: this.isFolder,
            sizeInBytes: this.sizeInBytes,
            permissions: this.permissions,
            isDirectory: this.isDirectory,
            dirname: this.dirname,
        }
    }
}

const cache = {}
export const FileSystem = {
    get home() {
        if (!cache.home) {
            if (Deno.build.os == "linux" || Deno.build.os == "darwin") {
                cache.home = Deno.env.get("HOME")
            } else if (Deno.build.os == "windows") {
                // untested
                cache.home = Deno.env.get("HOMEPATH")
            } else {
                return null
            }
        }
        return cache.home
    },
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
    dirname: Path.dirname,
    basename: Path.basename,
    extname: Path.extname,
    join: Path.join,
    async read(path) {
        try {
            return await Deno.readTextFile(path)
        } catch (error) {
            return null
        }
    },
    async info(fileOrFolderPath, _cachedLstat=null) {
        // compute lstat and stat before creating ItemInfo (so its async for performance)
        const lstat = _cachedLstat || await Deno.lstat(fileOrFolderPath).catch(()=>({doesntExist: true}))
        let stat = {}
        if (!lstat.isSymlink) {
            stat = {
                isBrokenLink: false,
                isLoopOfLinks: false,
            }
        // if symlink
        } else {
            try {
                stat = await Deno.stat(fileOrFolderPath)
            } catch (error) {
                if (error.message.match(/^Too many levels of symbolic links/)) {
                    stat.isBrokenLink = true
                    stat.isLoopOfLinks = true
                } else if (error.message.match(/^No such file or directory/)) {
                    stat.isBrokenLink = true
                } else {
                    // probably a permission error
                    // TODO: improve how this is handled
                    throw error
                }
            }
        }
        return new ItemInfo({path:fileOrFolderPath, _lstatData: lstat, _statData: stat})
    },
    remove: (fileOrFolder) => Deno.remove(fileOrFolder.path || fileOrFolder,{recursive: true}).catch(()=>false),
    makeRelativePath: ({from, to}) => Path.relative(from.path || from, to.path || to),
    makeAbsolutePath: (path)=> {
        if (!Path.isAbsolute(path)) {
            return Path.normalize(Path.join(Deno.cwd(), path))
        } else {
            return path
        }
    },
    async finalTargetPathOf(path) {
        path = path.path || path // if given ItemInfo object
        let result = await Deno.lstat(path).catch(()=>({doesntExist: true}))
        if (result.doesntExist) {
            return null
        }
        const pathChain = [ FileSystem.makeAbsolutePath(path) ]
        while (result.isSymlink) {
            // get the path to the target
            path = Path.relative(path, await Deno.readLink(path))
            result = await Deno.lstat(path).catch(()=>({doesntExist: true}))
            // check if target exists
            if (result.doesntExist) {
                return null
            }
            // check for infinite loops
            const absolutePath = FileSystem.makeAbsolutePath(path)
            if (pathChain.includes(absolutePath)) {
                // circular loop of links
                return null
            }
            pathChain.push(FileSystem.makeAbsolutePath(path))
        }
        return path
    },
    async ensureIsFolder(path) {
        path = path.path || path // if given ItemInfo object
        const parentPath = Path.dirname(path)
        // root is always a folder
        if (parentPath == path) {
            return
        } 
        // make sure parent is a folder
        const parent = await FileSystem.info(parentPath)
        if (!parent.isDirectory) {
            await FileSystem.ensureIsFolder(parentPath)
        }
        
        // delete files in the way
        const thisPath = await FileSystem.info(path)
        if (thisPath.exists && !thisPath.isDirectory) {
            await FileSystem.remove(thisPath)
        }
        
        // finally create the folder
        return Deno.mkdir(path, { recursive: true })
    },
    async clearAPathFor(path) {
        const parentPath = Path.dirname(path)
        return FileSystem.ensureIsFolder(parentPath)
    },
    async walkUpUntil(fileToFind, startPath=null){
        let here = startPath || Deno.cwd()
        if (!Path.isAbsolute(here)) {
            here = Path.join(cwd, fileToFind)
        }
        while (1) {
            let checkPath = Path.join(here, fileToFind)
            const pathInfo = await Deno.lstat(checkPath).catch(()=>({doesntExist: true}))
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
    // FIXME: make this work for folders with many options for how to handle symlinks
    async copy({from, to, force=true}) {
        const existingItemDoesntExist = (await Deno.stat(from).catch(()=>({doesntExist: true}))).doesntExist
        if (existingItemDoesntExist) {
            throw Error(`\nTried to copy from:${from}, to:${to}\nbut "from" didn't seem to exist\n\n`)
        }
        if (force) {
            await FileSystem.clearAPathFor(to)
            FileSystem.remove(to)
        }
        const source = await Deno.open(from, { read: true })
        const target = await Deno.create(to)
        result = await copy(source, target)
        Deno.close(source.rid)
        Deno.close(target.rid)
        return result
    },
    async relativeLink({existingItem, newItem}) {
        existingItem = existingItem.path || existingItem
        newItem = newItem.path || newItem // if given ItemInfo object

        const existingItemDoesntExist = (await Deno.lstat(existingItem).catch(()=>({doesntExist: true}))).doesntExist
        // if the item doesnt exists
        if (existingItemDoesntExist) {
            throw Error(`\nTried to create a relativeLink between existingItem:${existingItem}, newItem:${newItem}\nbut existingItem didn't actually exist`)
        } else {
            await FileSystem.clearAPathFor(newItem)
            await FileSystem.remove(newItem)
        }
        const pathFromNewToExisting = Path.relative(newItem, existingItem)
        return Deno.symlink(pathFromNewToExisting, existingItem)
    },
    async pathPieces(path) {
        path = path.path || path // if given ItemInfo object
        // const [ *folders, fileName, fileExtension ] = FileSystem.pathPieces(path)
        const result = Path.parse(path)
        const folderList = []
        let dirname = result.dir
        while (true) {
            folderList.push(dirname)
            // if at the top 
            if (dirname == result.root) {
                break
            }
            dirname = Path.dirname(dirname)
        }
        return [...folderList, result.name, result.ext ]
    },
    async listPathsIn(pathOrFileInfo){
        const info = pathOrFileInfo instanceof ItemInfo ? pathOrFileInfo : await FileSystem.info(pathOrFileInfo)
        // if not folder (includes if it doesn't exist)
        if (!info.isFolder) {
            return []
        }

        const path = info.path
        const results = []
        for await (const dirEntry of Deno.readDir(path)) {
            const eachPath = Path.join(path, dirEntry.name)
            results.push(eachPath)
        }
        return results
    },
    async listBasenamesIn(pathOrFileInfo){
        const info = pathOrFileInfo instanceof ItemInfo ? pathOrFileInfo : await FileSystem.info(pathOrFileInfo)
        // if not folder (includes if it doesn't exist)
        if (!info.isFolder) {
            return []
        }

        const path = info.path
        const results = []
        for await (const dirEntry of Deno.readDir(path)) {
            results.push(dirEntry.name)
        }
        return results
    },
    // TODO: make iteratePathsIn() that returns an async generator
    //       and make all these listing methods way more efficient in the future
    async listItemsIn(pathOrFileInfo) {
        const info = pathOrFileInfo instanceof ItemInfo ? pathOrFileInfo : await FileSystem.info(pathOrFileInfo)
        // if not folder (includes if it doesn't exist)
        if (!info.isFolder) {
            return []
        }

        const path = info.path
        const outputPromises = []
        // schedule all the info lookup
        for await (const fileOrFolder of Deno.readDir(path)) {
            const eachPath = Path.join(path,fileOrFolder.name)
            outputPromises.push(FileSystem.info(eachPath))
        }
        
        // then wait on all of them
        const output = []
        for (const each of outputPromises) {
            output.push(await each)
        }
        return output
    },
    // includes symlinks to files and pipes
    async listFileItemsIn(pathOrFileInfo, options={treatAllSymlinksAsFiles:false}) {
        const { treatAllSymlinksAsFiles } = {treatAllSymlinksAsFiles:false, ...options}
        const items = await FileSystem.listItemsIn(pathOrFileInfo)
        if (treatAllSymlinksAsFiles) {
            return items.filter(eachItem=>(eachItem.isFile || (treatAllSymlinksAsFiles && eachItem.isSymlink)))
        } else {
            return items.filter(eachItem=>eachItem.isFile)
        }
    },
    async listFilePathsIn(pathOrFileInfo, options={treatAllSymlinksAsFiles:false}) {
        return (await FileSystem.listItemsIn(pathOrFileInfo, options)).map(each=>each.path)
    },
    async listFileBasenamesIn(pathOrFileInfo, options={treatAllSymlinksAsFiles:false}) {
        return (await FileSystem.listItemsIn(pathOrFileInfo, options)).map(each=>each.basename)
    },
    
    async listFolderItemsIn(pathOrFileInfo, options={ignoreSymlinks:false}) {
        const { ignoreSymlinks } = {ignoreSymlinks:false, ...options}
        const items = await FileSystem.listItemsIn(pathOrFileInfo)
        if (ignoreSymlinks) {
            return items.filter(eachItem=>(eachItem.isFolder && !eachItem.isSymlink))
        } else {
            return items.filter(eachItem=>eachItem.isFolder)
        }
    },
    async listFolderPathsIn(pathOrFileInfo, options={ignoreSymlinks:false}) {
        return (await FileSystem.listItemsIn(pathOrFileInfo, options)).map(each=>each.path)
    },
    async listFolderBasenamesIn(pathOrFileInfo, options={ignoreSymlinks:false}) {
        return (await FileSystem.listItemsIn(pathOrFileInfo, options)).map(each=>each.basename)
    },
    async recursivelyListPathsIn(pathOrFileInfo, options={onlyHardlinks: false, dontFollowSymlinks: false}) {
        const info = pathOrFileInfo instanceof ItemInfo ? pathOrFileInfo : await FileSystem.info(pathOrFileInfo)
        // if not folder (includes if it doesn't exist)
        if (!info.isFolder) {
            return []
        }

        const path = info.path
        if (!options.alreadySeached) {
            options.alreadySeached = new Set()
        }
        const alreadySeached = options.alreadySeached
        // avoid infinite loops
        if (alreadySeached.has(path)) {
            return []
        }
        const absolutePathVersion = FileSystem.makeAbsolutePath(path)
        alreadySeached.add(absolutePathVersion)
        const results = []
        for await (const dirEntry of Deno.readDir(path)) {
            const eachPath = Path.join(path, dirEntry.name)
            if (dirEntry.isFile) {
                results.push(eachPath)
            } else if (dirEntry.isDirectory) {
                for (const each of await FileSystem.recursivelyListPathsIn(eachPath, {...options, alreadySeached})) {
                    results.push(each)
                }
            } else if (!options.onlyHardlinks && dirEntry.isSymlink) {
                if (options.dontFollowSymlinks) {
                    results.push(eachPath)
                } else {
                    const pathInfo = await FileSystem.info(eachPath)
                    if (pathInfo.isDirectory) {
                        for (const each of await FileSystem.recursivelyListPathsIn(eachPath, {...options, alreadySeached})) {
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
    async recursivelyListItemsIn(pathOrFileInfo, options={onlyHardlinks: false, dontFollowSymlinks: false}) {
        const paths = await FileSystem.recursivelyListPathsIn(pathOrFileInfo, options)
        const promises = paths.map(each=>FileSystem.info(each))
        const output = []
        for (const each of promises) {
            output.push(await each)
        }
        return output
    },
    async getPermissions({path}) {
        const {mode} = await Deno.lstat(path)
        // see: https://stackoverflow.com/questions/15055634/understanding-and-decoding-the-file-mode-value-from-stat-function-output#15059931
        return {
            owner: {        //          rwxrwxrwx
                canRead:    !!(0b0000000100000000 & mode),
                canWrite:   !!(0b0000000010000000 & mode),
                canExecute: !!(0b0000000001000000 & mode),
            },
            group: {
                canRead:    !!(0b0000000000100000 & mode),
                canWrite:   !!(0b0000000000010000 & mode),
                canExecute: !!(0b0000000000001000 & mode),
            },
            others: {
                canRead:    !!(0b0000000000000100 & mode),
                canWrite:   !!(0b0000000000000010 & mode),
                canExecute: !!(0b0000000000000001 & mode),
            },
        }
    },
    /**
     * Add/set file permissions
     *
     * @param {String} args.path - 
     * @param {Object|Boolean} args.recursively - 
     * @param {Object} args.permissions - 
     * @param {Object} args.permissions.owner - 
     * @param {Boolean} args.permissions.owner.canRead - 
     * @param {Boolean} args.permissions.owner.canWrite - 
     * @param {Boolean} args.permissions.owner.canExecute - 
     * @param {Object} args.permissions.group - 
     * @param {Boolean} args.permissions.group.canRead - 
     * @param {Boolean} args.permissions.group.canWrite - 
     * @param {Boolean} args.permissions.group.canExecute - 
     * @param {Object} args.permissions.others - 
     * @param {Boolean} args.permissions.others.canRead - 
     * @param {Boolean} args.permissions.others.canWrite - 
     * @param {Boolean} args.permissions.others.canExecute - 
     * @return {null} 
     *
     * @example
     *  await FileSystem.addPermissions({
     *      path: fileOrFolderPath,
     *      permissions: {
     *          owner: {
     *              canExecute: true,
     *          },
     *      }
     *  })
     */
    async addPermissions({path, permissions={owner:{}, group:{}, others:{}}, recursively=false}) {
        // just ensure the names exist
        permissions = { owner:{}, group:{}, others:{}, ...permissions }
        let permissionNumber = 0b000000000
        let fileInfo
        // if not all permissions are specified, go get the existing permissions
        if (!(Object.keys(permissions.owner).length === Object.keys(permissions.group).length === Object.keys(permissions.others).length === 3)) {
            fileInfo = await FileSystem.info(path)
            // just grab the last 9 binary digits of the mode number. See: https://stackoverflow.com/questions/15055634/understanding-and-decoding-the-file-mode-value-from-stat-function-output#15059931
            permissionNumber = fileInfo.mode & 0b0000000111111111
        }
        // 
        // set bits for the corrisponding permissions
        // 
        if (permissions.owner.canRead    ) { permissionNumber = permissionNumber | 0b1000000000 }
        if (permissions.owner.canWrite   ) { permissionNumber = permissionNumber | 0b0100000000 }
        if (permissions.owner.canExecute ) { permissionNumber = permissionNumber | 0b0001000000 }
        if (permissions.group.canRead    ) { permissionNumber = permissionNumber | 0b0000100000 }
        if (permissions.group.canWrite   ) { permissionNumber = permissionNumber | 0b0000010000 }
        if (permissions.group.canExecute ) { permissionNumber = permissionNumber | 0b0000001000 }
        if (permissions.others.canRead   ) { permissionNumber = permissionNumber | 0b0000000100 }
        if (permissions.others.canWrite  ) { permissionNumber = permissionNumber | 0b0000000010 }
        if (permissions.others.canExecute) { permissionNumber = permissionNumber | 0b0000000001 }
        
        // 
        // actually set the permissions
        // 
        if (
            recursively == false
            || (fileInfo instanceof Object && fileInfo.isFile) // if already computed, dont make a 2nd system call
            || (!(fileInfo instanceof Object) && (await FileSystem.info(path)).isFile)
        ) {
            return Deno.chmod(path, permissionNumber)
        } else {
            const promises = []
            const paths = await FileSystem.recursivelyListPathsIn(path, {onlyHardlinks: false, dontFollowSymlinks: false, ...recursively})
            // schedule all of them asyncly
            for (const eachPath of paths) {
                promises.push(
                    Deno.chmod(eachPath, permissionNumber).catch(console.error)
                )
            }
            // create a promise to then wait on all of them
            return new Promise(async (resolve, reject)=>{
                for (const each of promises) {
                    await each
                }
                resolve()
            })
        }
    },
    async write({path, data, force=true}) {
        if (force) {
            await FileSystem.clearAPathFor(path)
            const info = FileSystem.info(path)
            if (info.isDirectory) {
                FileSystem.remove(path)
            }
        }
        // string
        if (typeof data == 'string') {
            return Deno.writeTextFile(path, data)
        // assuming bytes (maybe in the future, readables and pipes will be supported)
        } else {
           return Deno.writeFile(path, data)
        }
    },
    async append({path, data, force=true}) {
        if (force) {
            await FileSystem.clearAPathFor(path)
            const info = FileSystem.info(path)
            if (info.isDirectory) {
                FileSystem.remove(path)
            }
        }
        const file = await Deno.open(path, {write: true, read:true, create: true})
        // go to the end of a file (meaning everthing will be appended)
        await Deno.seek(file.rid, 0, Deno.SeekMode.End)
        // string
        if (typeof data == 'string') {
            await Deno.write(file.rid, new TextEncoder().encode(data))
        // assuming bytes (maybe in the future, readables and pipes will be supported)
        } else {
            await Deno.write(file.rid, data)
        }
        // TODO: consider the possibility of this same file already being open somewhere else in the program, address/test how that might lead to problems
        await file.close()
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
    // pathPieces: (path)=>{
    //     // const [ *folders, fileName, fileExtension ] = FileSystem.pathPieces(path)
    //     const result = Path.parse(path)
    //     const folderList = []
    //     let dirname = result.dir
    //     while (true) {
    //         folderList.push(dirname)
    //         // if at the top 
    //         if (dirname == result.root) {
    //             break
    //         }
    //         dirname = Path.dirname(dirname)
    //     }
    //     return [...folderList, result.name, result.ext ]
    // },
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
//         const result = await Deno.lstat(parentPath).catch(()=>({doesntExist: true}))
//         // if no folder was there, create one
//         if (result.doesntExist) {
//             Deno.mkdir(Path.dirname(parentPath),{ recursive: true })
//         }
//     },
//     createFile: (path)=>FileSystem.delete(path).then(()=>FileSystem.ensureParentFolder(path)).then(()=>Deno.writeTextFile(path, "")),
    // listItems: (path)=>{
    //     const paths = []
    //     for await (const fileOrFolder of Deno.readDir(path)) {
    //         paths.push(Path.join(path,fileOrFolder.name))
    //     }
    //     return paths
    // },
    // // includes symlinks to files and pipes
    // listFiles: (path)=>{
    //     const paths = []
    //     for await (const fileOrFolder of Deno.readDir(path)) {
    //         const eachPath = Path.join(path,fileOrFolder.name)
    //         if (!((await Deno.lstat(eachPath)).isDirectory)) {
    //             paths.push(eachPath)
    //         }
    //     }
    //     return paths
    // },
    // listFolders: (path)=>{
    //     const paths = []
    //     for await (const fileOrFolder of Deno.readDir(path)) {
    //         const eachPath = Path.join(path,fileOrFolder.name)
    //         if (await Deno.lstat(eachPath).isDirectory) {
    //             paths.push(eachPath)
    //         }
    //     }
    //     return paths
    // },
//     read: (path)=>{
//         if (FileSystem.isFile(path)) {
//             return Deno.readTextFile(path)
//         }
//     },
//     targetOf: Deno.realPath,
//     write: ({data, to})=> FileSystem.delete(to).then(()=>FileSystem.ensureParentFolder(to)).then(()=>Deno.writeTextFile(to, data)),
//     // copy
//          // options for how to handle symbolic links when recursively copying a folder structure that possibly has symbolic links outside of subfolders
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
//     // home
//     // ownername
//     // tempfile
//     // tempfolder
//     // readBytes
//     // readStream
//     // append
// }