import * as fs from 'fs-extra'

export const testAppendFile = async (file: string, data: any) => {
  fs.appendFile(
    file,
    JSON.stringify({ time: new Date().toISOString(), data }, null, 2),
  )
}
