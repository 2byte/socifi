/**
 * NTPM Service Manager
 *
 * Scans the modules directory, loads NTPM module classes,
 * initializes them, and creates a combined Elysia plugin
 * with all HTTP + WS routes mounted into the main app.
 */

import { Elysia } from "elysia";
import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

interface NtpmModuleInstance {
  config: { slug: string; name: string; version: string };
  onInit(): Promise<void>;
  onDestroy(): Promise<void>;
  createPlugin(): Elysia;
  createWsServer(): Elysia;
}

interface NtpmModuleClass {
  new (): NtpmModuleInstance;
}

export class NtpmServiceManager {
  public static readonly serviceName = "ntpm-service";
  private static modules = new Map<string, NtpmModuleInstance>();

  /**
   * Scan modules directory, load and initialize all NTPM modules.
   * Call once on server startup.
   */
  public static async init(): Promise<void> {
    console.log(`[NTPM] Initializing ${NtpmServiceManager.serviceName}...`);
    const modulesDir = resolve(import.meta.dir, "../../../modules/note-post-modules");

    let entries: string[];
    try {
      const dirEntries = await readdir(modulesDir, { withFileTypes: true });
      entries = dirEntries
        .filter((e) => e.isDirectory() && e.name !== "core")
        .map((e) => e.name);
    } catch {
      console.warn("[NTPM] modules directory not found, skipping");
      return;
    }

    for (const dirName of entries) {
      try {
        const moduleDir = join(modulesDir, dirName);
        const moduleClass = await NtpmServiceManager.discoverModule(moduleDir, dirName);
        if (!moduleClass) continue;

        const instance = new moduleClass();
        await instance.onInit();

        NtpmServiceManager.modules.set(instance.config.slug, instance);
        console.log(`[NTPM] Loaded module: ${instance.config.slug} v${instance.config.version}`);
      } catch (err) {
        console.error(`[NTPM] Failed to load module "${dirName}":`, err);
      }
    }

    console.log(`[NTPM] ${NtpmServiceManager.modules.size} module(s) loaded`);
  }

  /**
   * Try to find and import the main module class from a directory.
   * Looks for files matching Ntpm*Module.ts pattern.
   */
  private static async discoverModule(
    moduleDir: string,
    dirName: string,
  ): Promise<NtpmModuleClass | null> {
    const files = await readdir(moduleDir);
    const mainFile = files.find(
      (f) => f.endsWith("Module.ts") && f.startsWith("Ntpm"),
    );

    if (!mainFile) {
      console.warn(`[NTPM] No Ntpm*Module.ts found in ${dirName}, skipping`);
      return null;
    }

    const modulePath = join(moduleDir, mainFile);
    const mod = await import(modulePath);

    // Find the first exported class that looks like an NTPM module
    for (const exportName of Object.keys(mod)) {
      const exported = mod[exportName];
      if (typeof exported !== "function") continue;

      // Check if it's a class (has prototype) and is a subclass of something
      // NtpmBaseModule subclasses will have their constructor set config.slug
      try {
        const instance = new exported();
        if (instance.config?.slug) {
          return exported as NtpmModuleClass;
        }
      } catch {
        // Skip non-instantiable exports
      }
    }

    console.warn(`[NTPM] No valid module class found in ${mainFile}`);
    return null;
  }

  /**
   * Create combined Elysia plugin with all loaded modules' HTTP + WS routes.
   * Mount into the main app with `.use(NtpmServiceManager.createPlugin())`.
   */
  public static createPlugin(): Elysia {
    let plugin = new Elysia();

    for (const [slug, instance] of NtpmServiceManager.modules) {
      // Mount HTTP routes (with :post_id param)
      plugin = plugin.use(instance.createPlugin());

      // Mount WS routes
      const wsPlugin = instance.createWsServer();
      if (wsPlugin) {
        plugin = plugin.use(wsPlugin);
      }

      console.log(`[NTPM] Mounted routes for module: ${slug}`);
    }

    return plugin;
  }

  /**
   * Get a loaded module instance by slug.
   */
  public static getModule(slug: string) {
    return NtpmServiceManager.modules.get(slug);
  }

  /**
   * Get all loaded module slugs.
   */
  public static getLoadedSlugs(): string[] {
    return [...NtpmServiceManager.modules.keys()];
  }


  /**
   * Shutdown all modules. Call on server stop.
   */
  public static async shutdown(): Promise<void> {
    for (const [slug, instance] of NtpmServiceManager.modules) {
      try {
        await instance.onDestroy();
        console.log(`[NTPM] Module ${slug} destroyed`);
      } catch (err) {
        console.error(`[NTPM] Error destroying module ${slug}:`, err);
      }
    }
    NtpmServiceManager.modules.clear();
  }
}