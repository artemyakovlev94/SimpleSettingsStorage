import archiver from "archiver";
import createError from "http-errors";
import dotenv from "dotenv";
import StorageModel from "../models/storageModel.mjs";

dotenv.config();

const storageModel = new StorageModel();

export async function getScheme(req, res, next) {
  let { node, without_files, depth } = req.query;
  node = node || '';
  without_files =
    without_files === "true" || without_files === "1" || without_files === 1;
  depth = depth ? parseInt(depth, 10) : Infinity;

  if (isNaN(depth) || depth < 0) {
    next(
      createError(
        400,
        "Параметр 'depth' должен быть неотрицательным целым числом."
      )
    );
    return;
  }

  const scheme = await storageModel.getScheme(node, depth, without_files);

  if (scheme) {
    res.json(scheme);
  } else {
    next(createError(404, "Не найдено."));
  }
}

export async function getFiles(req, res, next) {
  const files = req.body;
  if (!Array.isArray(files)) {
    next(createError(400, "Не передан массив запрашиваемых файлов."));
    return;
  }

  try {
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw new Error(err.message);
    });
    archive.pipe(res);

    const result = await storageModel.getFiles(files);
    result.forEach((dataFile) => {
      if (typeof dataFile.file === 'string') archive.file(dataFile.file, { name: dataFile.path });
      else archive.append(dataFile.file, { name: dataFile.path });
    });

    archive.finalize();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="files.zip"`);
  } catch (err) {
    next(createError(500, err.message));
  }
}

export async function webhookRepo(req, res, next) {
  const owner = req.body.repository.owner.login;
  const repo = req.body.repository.name;
  const ref = req.body.ref;

  let result = false;

  if (
    owner === process.env.GITHUB_OWNER &&
    repo === process.env.GITHUB_REPO &&
    ref === `refs/heads/${process.env.GITHUB_BRANCH}`
  ) {
    const commits = req.body.commits || [];
    let addedAndModifiedFiles = [];
    let removedFiles = [];

    commits.forEach((commit) => {
      addedAndModifiedFiles = [...new Set(addedAndModifiedFiles.concat(commit.added))];
      addedAndModifiedFiles = [...new Set(addedAndModifiedFiles.concat(commit.modified))];
      removedFiles = [...new Set(removedFiles.concat(commit.removed))];
    });
    
    storageModel.webhookRepo(addedAndModifiedFiles, removedFiles);
    result = true;
  }

  res.status(200).json({ status: result });
}

export async function syncRepo(req, res, next) {
  storageModel.syncRepo();
  res.json({ message: "Синхронизация запущена" });
}
