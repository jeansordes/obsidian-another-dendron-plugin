/**
 * __Csl = console__
 * 
 * This is useful for debugging purposes, in order to activate/deactivate the logging
 * on a per-function basis, combined with a detection of the environment (development/production).
 * 
 * The recommended usage is:
 * 
 * ```typescript
 * function yourFunction() {
 *     const csl = new Csl(); // or false when you want to disable the logging
 *     csl.clear(); // or Csl.clear()
 *     ...
 *     csl.log('[variableName]', variableName);
 *     ...
 * }
 * ```
 * 
 * This way, you can keep your logging in your code, and just edit the flag
 * to activate/deactivate the logging for the specific function.
 * 
 * When the code is built for production, even if you forget to turn off the flag,
 * it will not log anything, because NODE_ENV will not be 'development'.
 */
export class Csl {
    private isActive: boolean;

    constructor(debugIsActiveInThisFunction: boolean = true) {
        this.isActive = debugIsActiveInThisFunction;
    }

    public log(...objs: unknown[]) {
        if (this.isActive && process.env.NODE_ENV === 'development') {
            console.log(...objs);
        }
    }

    public static log(...objs: unknown[]) {
        if (process.env.NODE_ENV === 'development') {
            console.log(...objs);
        }
    }

    public clear() {
        if (this.isActive && process.env.NODE_ENV === 'development') {
            console.clear();
        }
    }

    public static clear() {
        if (process.env.NODE_ENV === 'development') {
            console.clear();
        }
    }
}