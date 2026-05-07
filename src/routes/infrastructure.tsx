import { Box, Container, Link, Paper, Typography } from "@mui/material";
import OpenInNew from "@mui/icons-material/OpenInNew";
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import {
  buildCognitoUserPoolUrl,
  buildCognitoIdentityPoolUrl,
  buildS3BucketUrl,
  buildAppSyncUrl,
  buildDynamoDBTableUrl,
} from "@/lib/aws-console-urls";
import outputs from "../../amplify_outputs.json";

export const Route = createFileRoute("/infrastructure")({
  beforeLoad: requireAuth,
  component: InfrastructurePage,
});

interface ResourceItemProps {
  label: string;
  value?: string;
  href?: string;
}

// Used by InfrastructurePage sections (Cognito, S3, AppSync, DynamoDB)
function ResourceItem({
  label,
  value,
  href,
}: ResourceItemProps): React.ReactElement {
  const displayValue = value || "—";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        py: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {href ? (
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
        >
          {displayValue}
          <OpenInNew fontSize="small" />
        </Link>
      ) : (
        <Typography variant="body2">{displayValue}</Typography>
      )}
    </Box>
  );
}

function InfrastructurePage() {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 2 }}>
        <Typography variant="h4" gutterBottom>
          AWS 資源連結
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Amazon Cognito
        </Typography>
        <ResourceItem
          label="User Pool ID"
          value={outputs.auth?.user_pool_id}
          href={buildCognitoUserPoolUrl(
            outputs.auth?.aws_region,
            outputs.auth?.user_pool_id,
          )}
        />
        <ResourceItem
          label="App Client ID"
          value={outputs.auth?.user_pool_client_id}
        />
        <ResourceItem
          label="Identity Pool ID"
          value={outputs.auth?.identity_pool_id}
          href={buildCognitoIdentityPoolUrl(
            outputs.auth?.aws_region,
            outputs.auth?.identity_pool_id,
          )}
        />
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Amazon S3
        </Typography>
        <ResourceItem
          label="Bucket Name"
          value={outputs.storage?.bucket_name}
          href={buildS3BucketUrl(outputs.storage?.bucket_name)}
        />
        <ResourceItem label="AWS Region" value={outputs.storage?.aws_region} />
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          AWS AppSync
        </Typography>
        <ResourceItem
          label="GraphQL Endpoint"
          value={outputs.data?.url}
          href={buildAppSyncUrl(outputs.data?.aws_region)}
        />
        <ResourceItem label="AWS Region" value={outputs.data?.aws_region} />
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Amazon DynamoDB
        </Typography>
        {Object.entries(outputs.custom.tables).map(([modelName, info]) => (
          <ResourceItem
            key={modelName}
            label={modelName}
            value={info.tableName}
            href={buildDynamoDBTableUrl(
              outputs.data?.aws_region,
              info.tableName,
            )}
          />
        ))}
      </Paper>
    </Container>
  );
}
