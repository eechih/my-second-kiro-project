import Breadcrumbs from "@mui/material/Breadcrumbs";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useNavigate } from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";

interface PageHeaderProps {
  section: string;
  current: string;
  title: string;
  actions?: ReactNode;
  sectionLink?: {
    href: string;
    onClick: () => void;
  };
}

/**
 * 頁面標頭，統一列表與表單頁常見的「首頁 / 模組 / 目前頁」與標題排版。
 */
export function PageHeader({
  section,
  current,
  title,
  actions,
  sectionLink,
}: PageHeaderProps): ReactElement {
  const navigate = useNavigate();

  return (
    <>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            void navigate({ to: "/" });
          }}
        >
          首頁
        </Link>
        {sectionLink ? (
          <Link
            underline="hover"
            color="inherit"
            href={sectionLink.href}
            onClick={(e) => {
              e.preventDefault();
              sectionLink.onClick();
            }}
          >
            {section}
          </Link>
        ) : (
          <Typography color="text.primary">{section}</Typography>
        )}
        <Typography color="text.primary">{current}</Typography>
      </Breadcrumbs>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h5">{title}</Typography>
        {actions && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {actions}
          </Box>
        )}
      </Box>
    </>
  );
}
