"use client"

import { useRef, useTransition } from "react"
import { ImageUp, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getInitials } from "@/components/dashboard/user-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { createClient } from "@/libs/supabase/client"
import { removeAvatar, setAvatar } from "../actions"
import { AVATARS_BUCKET } from "../avatar"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const AVATAR_SIZE = 256
// El bucket limita a 1 MB; un WebP de 256×256 queda muy por debajo
const MAX_UPLOAD_SIZE = 1024 * 1024

/** Recorta al centro en cuadrado y exporta un WebP de 256×256 */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)

  const canvas = document.createElement("canvas")
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Canvas no disponible")
  }

  context.imageSmoothingQuality = "high"
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  )
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  )

  // Navegadores sin soporte de WebP en canvas devuelven PNG
  if (!blob || blob.type !== "image/webp" || blob.size > MAX_UPLOAD_SIZE) {
    throw new Error("No se pudo convertir la imagen")
  }

  return blob
}

interface AvatarUploaderProps {
  userId: string
  name: string
  avatarUrl: string | null
}

export function AvatarUploader({
  userId,
  name,
  avatarUrl
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  function upload(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("La foto debe ser JPG, PNG o WebP")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("La foto debe pesar máximo 5 MB")
      return
    }

    startTransition(async () => {
      let blob: Blob
      try {
        blob = await toSquareWebp(file)
      } catch {
        toast.error("No se pudo procesar la foto. Prueba con otra")
        return
      }

      const path = `${userId}/${crypto.randomUUID()}.webp`
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, blob, { contentType: "image/webp", upsert: false })

      if (uploadError) {
        toast.error("No se pudo subir la foto. Intenta de nuevo")
        return
      }

      const result = await setAvatar(path)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Foto actualizada")
      }
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await removeAvatar()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Foto quitada")
      }
    })
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16 rounded-xl">
        {avatarUrl && (
          <AvatarImage
            src={avatarUrl}
            alt={name}
          />
        )}
        <AvatarFallback className="rounded-xl text-lg">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <ImageUp data-icon="inline-start" />
            {pending ? "Guardando..." : "Subir foto"}
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={remove}
            >
              <Trash2 data-icon="inline-start" />
              Quitar foto
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG o WebP de hasta 5 MB. Se recorta en cuadrado.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Permite volver a elegir el mismo archivo
          event.target.value = ""
          if (file) {
            upload(file)
          }
        }}
      />
    </div>
  )
}
