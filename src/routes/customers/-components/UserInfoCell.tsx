import { Avatar, Box, Typography } from "@mui/material";
import { getAvatarColor, getAvatarLetter } from "@/lib/avatar-utils";

export interface UserInfoCellProps {
  name: string;
  contactPerson: string;
}

/**
 * 客戶資訊複合儲存格元件
 * 左側顯示 Avatar（名稱首字元 + 衍生色彩），右側顯示客戶名稱與聯絡人
 */
export function UserInfoCell({
  name,
  contactPerson,
}: UserInfoCellProps): React.ReactElement {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Avatar
        sx={{
          bgcolor: getAvatarColor(name),
          width: 36,
          height: 36,
          fontSize: "0.875rem",
        }}
      >
        {getAvatarLetter(name)}
      </Avatar>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {contactPerson}
        </Typography>
      </Box>
    </Box>
  );
}
