import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { AccountCard } from "@/components/account/AccountCard";
import { useAccounts } from "@/hooks/useAccounts";

export function MainPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useAccounts();

  if (isLoading) {
    return <p className="py-8 text-center text-muted-foreground">{t("common.loading")}</p>;
  }

  if (isError) {
    return <p className="py-8 text-center text-destructive">{t("common.error")}</p>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-base font-medium">{t("accounts.empty_title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("accounts.empty_hint")}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-3"
    >
      <AnimatePresence initial={false}>
        {data.map((account) => (
          <motion.div
            key={account.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <AccountCard account={account} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
