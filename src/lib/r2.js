import { supabase, supabaseConfigured } from './supabase.js'

const MAX_BYTES = 25 * 1024 * 1024
const allowedTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export function validateUploadFile(file) {
  if (!file) return { ok: false, message: 'No file selected' }
  if (file.size > MAX_BYTES) return { ok: false, message: 'File too large (max 25MB)' }
  if (file.type && !allowedTypes.includes(file.type)) {
    return { ok: false, message: 'Unsupported file type' }
  }
  return { ok: true }
}

export async function getR2PresignedUrl({ filename, contentType, folder }) {
  if (!supabaseConfigured) {
    return {
      presignedUrl: '',
      publicUrl: '',
      key: `guest/${folder}/${filename}`,
    }
  }
  const { data, error } = await supabase.functions.invoke('get-r2-presigned-url', {
    body: {
      filename,
      content_type: contentType,
      folder,
    },
  })
  if (error) throw error
  return data
}

export async function uploadToR2({ file, folder, onProgress }) {
  const validation = validateUploadFile(file)
  if (!validation.ok) throw new Error(validation.message)

  if (!supabaseConfigured) {
    if (typeof onProgress === 'function') onProgress(100)
    const url = URL.createObjectURL(file)
    const key = `guest/${folder}/${file.name}`
    return { fileUrl: url, r2Key: key, fileName: file.name }
  }

  const presign = await getR2PresignedUrl({
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    folder,
  })

  const { presignedUrl, publicUrl, key } = presign || {}
  if (!presignedUrl || !publicUrl || !key) {
    throw new Error('Invalid presigned URL response')
  }

  await putWithProgress(presignedUrl, file, file.type, onProgress)

  return { fileUrl: publicUrl, r2Key: key, fileName: file.name }
}

export async function deleteR2Object(r2Key) {
  if (!supabaseConfigured) {
    return { ok: true, r2_key: r2Key }
  }
  const { data, error } = await supabase.functions.invoke('delete-r2-object', {
    body: { r2_key: r2Key },
  })
  if (error) throw error
  return data
}

function putWithProgress(url, file, contentType, onProgress) {
  if (!onProgress || typeof XMLHttpRequest === 'undefined') {
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    }).then(async (res) => {
      if (!res.ok) throw new Error('Upload failed')
    })
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    if (contentType) xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error('Upload failed'))
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(file)
  })
}
