import Nav from '@/components/Nav'
import { PredictPageSkeleton } from '@/components/LoadingSkeletons'

export default function PredictLoading() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
            <Nav initials="PL" />
            <PredictPageSkeleton />
        </div>
    )
}
