// Sketch
//
// Need an easy way of getting and setting settings
// If a setting is not set, the default should probably be returned.
// That probably means that binds etc. should be per-key?
//
// We should probably store all settings in memory, and only load from storage on startup and when we set it
//
// Really, we'd like a way of just letting things use the variables
//
import { DEFAULTS } from './config-defaults'

const CONFIGNAME = "userconfig"
const RC_NAME = "rc-text"

const asyncGetters = []
let initialised = false
let userConfig = o({})

// TEMP: get active userconfig
export function getAllConfig(): object {
    return DEFAULTS
}

/**
 * Get the value of the key target. If the user has not specified a key, use the
 * corresponding key from defaults, if one exists, else undefined.
 */
export function get(...target: string[]): any {
    return getDeepProperty(userConfig, target)
}

/**
 * Given an object and a target, extract the target if it exists, else return
 * undefined
 */
function getDeepProperty(obj: object, target: string[]) {
    if (obj !== undefined && target.length) {
        return getDeepProperty(obj[target[0]], target.slice(1))
    }
    return obj
}

/**
 * Get the value of the key target, but wait for config to be loaded from the
 * database first if it has not been at least once before. This is useful if you
 * are a content script and you've just been loaded.
*/
export async function getAsync(...target: string[]): Promise<any> {
    if (initialised) { return get(...target) }
    return new Promise(resolve => asyncGetters.push(() => resolve(get(...target))))
}

/** Full target specification, then value

    e.g.
        set("nmaps", "o", "open")
        set("search", "default", "google")
        set("aucmd", "BufRead", "memrise.com", "open memrise.com") */
export function set(...args: any[]): void {
    if (args.length < 2) { throw "You must provide at least two arguments!" }

    const target = args.slice(0, args.length - 1)
    const value = args[args.length - 1]

    setDeepProperty(userConfig, value, target)

    /** Create the key path target if it doesn't exist and set the final
     * property to value. If the path is an empty array, replace the obj. */
    function setDeepProperty(obj, value, target) {
        if (target.length > 1) {
            // If necessary antecedent objects don't exist, create them.
            if (obj[target[0]] === undefined) { obj[target[0]] = o({}) }
            setDeepProperty(obj[target[0]], value, target.slice(1))
        } else {
            obj[target[0]] = value
        }
    }
}

/** Delete the key at target if it exists */
export function unset(...target: string[]): void {
    const parent = getDeepProperty(userConfig, target.slice(0, -1))
    if (parent !== undefined) delete parent[target[target.length - 1]]
}

/**
 * Read all user configuration from storage API then notify any waiting
 * asynchronous calls generated by getAsync.
*/
async function init(): Promise<void> {
    try {
        // Merge defaults into config
        Object.assign(userConfig, DEFAULTS)

        // Before we had a config system, we had nmaps, and we put them in the
        // root namespace because we were young and bold.
        // let legacy_nmaps = await browser.storage.sync.get("nmaps")
        // if (legacy_nmaps) {
        //     USERCONFIG["nmaps"] = Object.assign(legacy_nmaps["nmaps"], USERCONFIG["nmaps"])
        // }
    } finally {
        initialised = true
        for (let waiter of asyncGetters) {
            waiter()
        }
    }
}

// make a naked object
function o(object) { return Object.assign(Object.create(null), object) }

// Listen for changes to the storage and update the USERCONFIG if appropriate.
// TODO: BUG! Sync and local storage are merged at startup, but not by this thing.
browser.storage.onChanged.addListener(
    (changes, areaname) => {
        if (CONFIGNAME in changes) {
            userConfig = changes[CONFIGNAME].newValue
        }
    }
)

init()
