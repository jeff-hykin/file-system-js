const Path = await import("https://deno.land/std@0.117.0/path/mod.ts")

export const Console = {
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