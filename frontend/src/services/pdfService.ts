import api from './api'

export interface UploadResponse {
  message: string
  document_id: string
  filename: string
  total_pages: number
  total_characters: number
  total_chunks: number
  saved_chunks: number
}

export const uploadPdf = async (file: File) => {
  const formData = new FormData()

  formData.append('file', file)

  const response = await api.post<UploadResponse>(
    '/pdf/upload',
    formData
  )

  return response.data
}