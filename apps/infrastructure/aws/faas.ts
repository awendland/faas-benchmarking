import * as fs from 'fs'
import archiver = require('archiver')
import { IFaasSize, IFaasRuntime } from '../shared'

export type IAwsFaasSize = '128' | '256' | '512' | '1024' | '2048'
export type IAwsFaasRuntime = 'nodejs8.10'

export const translateToAws = {
  size: (faasSize: IFaasSize): IAwsFaasSize => faasSize,
  runtime: (faasRuntime: IFaasRuntime): IAwsFaasRuntime =>
    ({
      node8: 'nodejs8.10',
    }[faasRuntime] as IAwsFaasRuntime),
}

export const prepareHandlerCodeZip = (sourceDir: string, outfile: string) =>
  new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outfile)
    output.on('error', reject)
    output.on('close', resolve)
    const archive = archiver('zip')
    archive.on('warning', reject)
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
