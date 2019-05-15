import * as fs from 'fs'
import archiver = require('archiver')
import { FaasSize, FaasRuntime } from '../shared'

export type AwsFaasSize = '128' | '256' | '512' | '1024' | '2048'
export type AwsFaasRuntime = 'nodejs8.10'

export const translateToAws = {
  size: (faasSize: FaasSize): AwsFaasSize => faasSize,
  runtime: (faasRuntime: FaasRuntime): AwsFaasRuntime =>
    ({
      node8: 'nodejs8.10',
    }[faasRuntime] as AwsFaasRuntime),
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
