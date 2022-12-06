let productBucket = null;

module.exports.resolve = async ({serverless, variableUtils, slsHelper, logUtils}) => {
  if (productBucket !== null) {
    return productBucket;
  }

  const {resolveVariable, serviceDir} = variableUtils;
  const {log} = logUtils;
  const s3 = slsHelper.createAwsClient('S3');
  let product;
  try {
    product = await resolveVariable('self:custom.product');
  } catch (e) {
    throw new serverless.classes.Error('To create product bucket you must provide `custom.product` property.');
  }

  const getBucketName = async (awsAccountDomainName) => {
    return `${product}.${slsHelper.region}.${awsAccountDomainName}`.toLocaleLowerCase();
  };

  const isBucketCreationNecessary = (bucketName) => {
    return new Promise((resolve, reject) => {
      s3.headBucket({Bucket: bucketName}).promise()
          .then(_ => resolve(false))
          .catch(error => {
            if (error.statusCode === 404) {
              resolve(true);
              return;
            }
            if (error.statusCode === 403) {
              resolve(false);
              return;
            }
            reject(new serverless.classes.Error(`Error by fetching informations about '${bucketName}' bucket. ${error.message}`));
          });
    });
  };

  const createBucket = (bucketName) => {
    return new Promise((resolve, reject) => {
      let region = slsHelper.region;
      let params = {
        Bucket: bucketName,
        CreateBucketConfiguration: {
          LocationConstraint: region
        }
      };
      if (region === 'us-east-1') {
        params = {
          Bucket: bucketName
        };
      }
      s3.createBucket(params).promise()
          .then(resolve)
          .catch(error => reject(new serverless.classes.Error(`Failed to create bucket with name '${bucketName}. ${error.message}'`)));
    });
  };

  const blockPublicAccess = (bucketName) => {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        }
      };
      s3.putPublicAccessBlock(params).promise()
          .then(resolve)
          .catch(error => reject(new serverless.classes.Error(`Failed to block public access for bucket '${bucketName}'. ${error.message}`)));
    });
  };

  const isPublicAccessBlocked = (bucketName) => {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: bucketName
      };
      s3.getPublicAccessBlock(params).promise()
          .then(data => {
            const bucketConfig = data.PublicAccessBlockConfiguration;
            const hasBlockedPublicAccess =
                bucketConfig.BlockPublicAcls === true &&
                bucketConfig.BlockPublicPolicy === true &&
                bucketConfig.IgnorePublicAcls === true &&
                bucketConfig.RestrictPublicBuckets === true;

            resolve(hasBlockedPublicAccess);
          })
          .catch(error => reject(new serverless.classes.Error(`Could not get public access configuration for '${bucketName}' bucket. ${error.message}`)));
    });
  };

  const applyComponentCustomization = (bucketName) => {
    return new Promise(async (resolve, reject) => {
      try {
        const custom = require(`${serviceDir}/component-customizations`);
        await custom.customizeProductBucket?.(serverless, bucketName);
        resolve();
      } catch (error) {
        if (error instanceof Error && error.code === 'MODULE_NOT_FOUND') {
          // no custom application configuration present, all good
          resolve();
          return;
        }

        reject(new serverless.classes.Error(`Error while applying custom configuration for product bucket '${bucketName}'. ${error.message}`));
      }
    });
  };

  productBucket = new Promise(async (resolve, reject) => {
    try {
      const accountDomainName = await resolveVariable('stencil(account):domain');
      const bucketName = await getBucketName(accountDomainName);

      if (await isBucketCreationNecessary(bucketName)) {
        await createBucket(bucketName);
        await blockPublicAccess(bucketName);
      } else {
        if (!(await isPublicAccessBlocked(bucketName))) {
          log.warning(`Public access for product bucket '${bucketName}' is not blocked. Fixing.`);
          await blockPublicAccess(bucketName);
        }
      }
//       await configureLifecycleRulesIfNecessary(bucketName);
      await applyComponentCustomization(bucketName);
      resolve(bucketName);
    } catch (error) {
      reject(error);
    }
  });
  return productBucket;
};
