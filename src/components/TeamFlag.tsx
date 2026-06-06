import Image from 'next/image'
import { getFlagUrl } from '@/lib/wc2026-data'

interface Props {
    teamCode: string
    size?: number
    style?: React.CSSProperties
}

/**
 * Optimized flag image component using next/image.
 * Serves flags in WebP/AVIF format with automatic resizing.
 */
export default function TeamFlag({ teamCode, size = 32, style }: Props) {
    const url = getFlagUrl(teamCode)
    if (!url) return <span style={{ display: 'inline-block', width: size, height: Math.round(size * 0.6) }} />

    return (
        <Image
            src={url}
            alt={teamCode}
            width={size}
            height={Math.round(size * 0.6)}
            style={{ borderRadius: 2, objectFit: 'cover', ...style }}
            unoptimized={false}
        />
    )
}
