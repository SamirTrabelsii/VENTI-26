'use client'

import { motion, HTMLMotionProps } from 'framer-motion'

export default function MotionDiv(props: HTMLMotionProps<"div">) {
    return <motion.div {...props} />
}
