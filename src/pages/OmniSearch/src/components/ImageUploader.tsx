import { useState, useRef, useCallback } from 'react'
import { Upload, Link2, X, ImageIcon, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface ImageUploaderProps {
  onImageSelected: (imageUrl: string) => void
  onClose?: () => void
}

export function ImageUploader({ onImageSelected, onClose }: ImageUploaderProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [urlInput, setUrlInput] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleSubmit = () => {
    const finalUrl = mode === 'url' ? urlInput : preview
    if (finalUrl) onImageSelected(finalUrl)
  }

  const clearImage = () => {
    setPreview(null)
    setUrlInput('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const hasImage = (mode === 'upload' && preview) || (mode === 'url' && urlInput)

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 rounded-lg bg-[#141414] border border-white/[0.06]">
        <button
          onClick={() => setMode('upload')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            mode === 'upload'
              ? 'bg-[rgba(255,0,13,0.1)] text-[#ff000d]'
              : 'text-[#a9a9a9] hover:text-[#ff000d] hover:bg-[rgba(255,0,13,0.06)]'
          )}
        >
          <Upload size={13} />
          Upload
        </button>
        <button
          onClick={() => setMode('url')}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            mode === 'url'
              ? 'bg-[rgba(255,0,13,0.1)] text-[#ff000d]'
              : 'text-[#a9a9a9] hover:text-[#ff000d] hover:bg-[rgba(255,0,13,0.06)]'
          )}
        >
          <Link2 size={13} />
          URL
        </button>
        {onClose && (
          <button onClick={onClose} className="px-2 py-1 rounded-md text-[#4d4d4d] hover:text-[#ff000d] transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Upload zone / URL input */}
      {mode === 'upload' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !preview && fileInputRef.current?.click()}
          className={clsx(
            'relative rounded-lg border-2 border-dashed transition-all cursor-pointer min-h-[120px] flex flex-col items-center justify-center gap-2',
            dragging
              ? 'border-[#ff000d] bg-[rgba(255,0,13,0.06)]'
              : preview
                ? 'border-white/[0.06] bg-[#0a0a0a]'
                : 'border-white/[0.1] bg-[#141414] hover:border-[rgba(255,0,13,0.3)]'
          )}
        >
          {uploading ? (
            <Loader2 size={24} className="animate-spin text-[#ff000d]" />
          ) : preview ? (
            <>
              <img src={preview} alt="Preview" className="max-h-[200px] rounded-lg object-contain" />
              <button
                onClick={(e) => { e.stopPropagation(); clearImage() }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#000000]/80 border border-white/[0.1] flex items-center justify-center text-[#a9a9a9] hover:text-[#ff000d] transition-colors"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-[rgba(255,0,13,0.08)] flex items-center justify-center">
                <ImageIcon size={18} className="text-[#ff000d]" />
              </div>
              <p className="text-xs text-[#a9a9a9]">Drop image here or <span className="text-[#ff000d]">browse</span></p>
              <p className="text-[10px] text-[#4d4d4d]">PNG, JPG, WEBP up to 10MB</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-[#141414]">
          <Link2 size={14} className="text-[#4d4d4d] flex-shrink-0" />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 bg-transparent text-sm text-[#f0ede8] placeholder-[#4d4d4d] outline-none"
          />
          {urlInput && (
            <button onClick={() => setUrlInput('')} className="text-[#4d4d4d] hover:text-[#ff000d] transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* URL preview */}
      {mode === 'url' && urlInput && (
        <div className="rounded-lg border border-white/[0.06] bg-[#0a0a0a] p-2 flex items-center gap-2">
          <img src={urlInput} alt="Preview" className="w-12 h-12 rounded object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <p className="text-[10px] text-[#4d4d4d] truncate flex-1">{urlInput}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!hasImage || uploading}
        className="w-full py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-30"
        style={{ background: 'linear-gradient(135deg, #ff000d, #8c1020)', boxShadow: '0 0 12px rgba(255,0,13,0.3)' }}
      >
        {hasImage ? 'Search 55 platforms with this image' : 'Add an image to search'}
      </button>
    </div>
  )
}
