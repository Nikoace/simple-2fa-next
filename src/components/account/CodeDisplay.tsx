import { AnimatePresence, motion } from "framer-motion";

type Props = {
  code: string;
  digits: number;
};

function formatCode(code: string, digits: number): string {
  if (code.length !== digits) {
    return code;
  }
  const half = Math.ceil(digits / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}

export function CodeDisplay({ code, digits }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={code}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.1 }}
        className="font-mono text-2xl tracking-[0.15em] tabular-nums select-none"
      >
        {formatCode(code, digits)}
      </motion.span>
    </AnimatePresence>
  );
}
