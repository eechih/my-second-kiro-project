/** 建構 Cognito User Pool Console URL */
export function buildCognitoUserPoolUrl(
  region: string,
  userPoolId: string,
): string {
  return `https://${region}.console.aws.amazon.com/cognito/v2/idp/user-pools/${userPoolId}/users`;
}

/** 建構 Cognito Identity Pool Console URL */
export function buildCognitoIdentityPoolUrl(
  region: string,
  identityPoolId: string,
): string {
  return `https://${region}.console.aws.amazon.com/cognito/v2/identity/identity-pools/${identityPoolId}`;
}

/** 建構 S3 Bucket Console URL */
export function buildS3BucketUrl(bucketName: string): string {
  return `https://s3.console.aws.amazon.com/s3/buckets/${bucketName}`;
}

/** 建構 AppSync Console URL */
export function buildAppSyncUrl(region: string): string {
  return `https://${region}.console.aws.amazon.com/appsync/home?region=${region}#/apis`;
}

/** 建構 DynamoDB Table Console URL */
export function buildDynamoDBTableUrl(
  region: string,
  tableName: string,
): string {
  return `https://${region}.console.aws.amazon.com/dynamodbv2/home?region=${region}#table?name=${tableName}`;
}
