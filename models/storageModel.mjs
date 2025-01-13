import fs from "fs";
import path from "path";
import tmp from "tmp";
import fsExtra from "fs-extra";
import GitHubProvider from "../providers/GitHubProvider.mjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STORAGE_DIR = path.join(__dirname, "..", "storage");

export default class StorageModel {
  constructor() {
    this.dataDir = join(STORAGE_DIR, "data");
    this.schemeFile = path.join(STORAGE_DIR, "scheme.json");

    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (error) {
      throw `Ошибка инициализации директории хранилища: ${error}`;
    }
  }

  async initScheme() {
    let scheme = {};

    try {
      scheme = await this.#scanDir();
    } catch (error) {
      console.error(error);
    }

    await fs.promises.writeFile(
      this.schemeFile,
      JSON.stringify(scheme, null, 2)
    );
    return this.schemeFile;
  }

  getScheme = async (node = null, depth = null, without_files = false) => {
    let scheme = {};

    if (fs.existsSync(this.schemeFile)) {
      try {
        scheme = JSON.parse(
          await fs.promises.readFile(this.schemeFile, "utf8")
        );
        scheme = this.#extractSchemeByNode(scheme, node);
        scheme = this.#extractSchemeByFilter(scheme, without_files, depth);
      } catch (error) {
        console.error(error);
      }
    }

    return scheme;
  };

  getFiles = async (files) => {
    let result = { found: [], notFound: [] };

    files.forEach((file) => {
      const relativePath = `${path.join(...file.split("\\"))}.xml`;
      const absolutePath = path.join(this.dataDir, relativePath);

      if (fs.existsSync(absolutePath)) {
        result.found.push({ relative: relativePath, absolute: absolutePath });
      } else {
        result.notFound.push(file);
      }
    });

    return result;
  };

  webhookRepo = async (addFiles, removeFiles) => {

    try {
      for await (const removeFile of removeFiles)
        await this.#deleteFileAndEmptyDirs(removeFile);
    } catch (error) {
      console.error(`Ошибка при удалении файла: ${error}`);
    }
    
    try {
      for await (const addFile of addFiles)
        await new GitHubProvider().downloadFile(this.dataDir, addFile);
    } catch (error) {
      console.error(`Ошибка при загрузке файла из репозитория: ${error}`);
    }

    this.initScheme();
  };

  syncRepo = async () => {
    const tempDir = tmp.dirSync({ unsafeCleanup: true }).name;

    try {
      await new GitHubProvider().downloadRepo(tempDir, ['.xml', '.json']);
      await fsExtra.emptyDir(this.dataDir);
      await fsExtra.move(tempDir, this.dataDir, { overwrite: true });
      this.initScheme();
      console.log("Синхронизация с репозиторием завершена");
    } catch (error) {
      console.error("Ошибка при загрузке файлов из репозитория:", error);
    } finally {
      try {
        await fsExtra.remove(tempDir);
      } catch (cleanupError) {
        console.error(
          "Ошибка при удалении временной папки синхронизации репозитория:",
          cleanupError
        );
      }
    }
  };

  #scanDir = async (relativePath = "") => {
    let structure = {};
    const dir = path.join(this.dataDir, relativePath); // Комбинируем BASE_DIR с относительным путем
    const items = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const itemRelativePath = path.join(relativePath, item.name);
      const itemName = path.basename(item.name, path.extname(item.name));

      if (item.isDirectory()) {
        const descPath = path.join(dir, `${itemName}.json`);
        if (fs.existsSync(descPath)) {
          const descContent = JSON.parse(
            await fs.promises.readFile(descPath, "utf8")
          );
          if (descContent.skip === true) continue;

          const filteredDesc = Object.fromEntries(
            Object.entries(descContent).filter(
              ([key]) => !["type", "children"].includes(key)
            )
          );

          let subItems = await this.#scanDir(itemRelativePath);
          if (Object.keys(subItems).length > 0) {
            structure[item.name] = {
              type: "directory",
              children: subItems,
              ...filteredDesc,
            };
          }
        } else {
          let subItems = await this.#scanDir(itemRelativePath);
          if (Object.keys(subItems).length > 0) {
            structure[item.name] = {
              type: "directory",
              children: subItems,
            };
          }
        }
      } else if (item.isFile() && path.extname(item.name) === ".xml") {
        const descPath = path.join(dir, `${itemName}.json`);
        const fileStructure = {
          type: "file",
        };

        if (fs.existsSync(descPath)) {
          const descContent = JSON.parse(
            await fs.promises.readFile(descPath, "utf8")
          );
          if (descContent.skip === true) continue;

          const filteredDesc = Object.fromEntries(
            Object.entries(descContent).filter(
              ([key]) => !["type", "children"].includes(key)
            )
          );

          Object.assign(fileStructure, filteredDesc);
        }

        structure[itemName] = fileStructure;
      }
    }

    return structure;
  };

  #extractSchemeByNode = (scheme, node) => {
    if (node === null) {
      return scheme;
    }

    let nodeParts = node.split("/");
    let currentNode = scheme;

    for (let part of nodeParts) {
      if (currentNode[part] && currentNode[part].type === "directory") {
        currentNode = currentNode[part].children
          ? currentNode[part].children
          : {};
      } else {
        return {};
      }
    }

    return currentNode;
  };

  #extractSchemeByFilter = (
    scheme,
    only_directory = false,
    depth = null,
    current_depth = 0
  ) => {
    const processNode = (node, current_depth) => {
      if (
        typeof node !== "object" ||
        node === null ||
        (only_directory && node.type !== "directory")
      )
        return null;

      const result = { ...node };

      if (depth !== null && current_depth >= depth) {
        result.children = {};
      } else if (result.children) {
        result.children = Object.entries(result.children)
          .map(([key, child]) => {
            const processedChild = processNode(child, current_depth + 1);
            return processedChild ? [key, processedChild] : null;
          })
          .filter((item) => item !== null)
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {});
      }
      return result;
    };

    const result = {};

    Object.entries(scheme).forEach(([key, value]) => {
      const processed = processNode(value, current_depth);
      if (processed) {
        result[key] = processed;
      }
    });

    return Object.keys(result).length > 0 ? result : {};
  };

  #deleteFileAndEmptyDirs = async (filePath) => {
    const fileExists = await fsExtra.pathExists(filePath);
    if (fileExists) await fsExtra.remove(filePath);

    let dirPath = path.dirname(filePath);
    while (dirPath !== path.dirname(dirPath)) {
      const files = await fsExtra.readdir(dirPath);
      if (files.length === 0) {
        await fsExtra.remove(dirPath);
        dirPath = path.dirname(dirPath);
      } else {
        break;
      }
    }
  };
}
