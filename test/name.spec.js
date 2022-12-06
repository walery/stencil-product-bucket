const test = require('ava');

test.serial('should return bucket name if bucket exists and has correct configuration', async t => {
  const actual = await resolveName(t);
  t.is(actual, 'testProduct.foo-central-42.test.foo.bar');
});

test.serial('should throw serverless Error if custom.product is not set', async t => {
  const mockOverwrites = {
    variableUtilsOverwrites: {
      'self:custom.product': undefined,
    },
  };

  const actual = await t.throwsAsync(
    resolveName(t, mockOverwrites)
  );
  t.true(actual instanceof TestError);
  t.is(actual.message, 'To create product bucket you must provide `custom.product` property.');
});

const resolveName = (t, overwrites = {}) => {
  const serverlessMock = getDefaultServerlessMock(overwrites.serverlessOverwrites);
  const variableUtilsMock = getDefaultVariableUtilsMock(overwrites.variableUtilsOverwrites);
  const slsHelperMock = getDefaultSlsHelperMock(overwrites.slsHelperOverwrites, t);
  const logUtilsMock = getDefaultLogUtilsMock(overwrites.logUtilsMock);

  const underTest = createUncachedInstance();

  return underTest.resolve({
    serverless: serverlessMock,
    variableUtils: variableUtilsMock,
    slsHelper: slsHelperMock,
    logUtils: logUtilsMock,
  });
};

const createUncachedInstance = () => {
  delete require.cache[require.resolve('../blocks/name')]
  return require('../blocks/name');
};


const getDefaultServerlessMock = (overwrites) => {
  const serverlessMock = {
    classes: {
      Error: TestError,
    },
  };
  return Object.assign(serverlessMock, overwrites);
};

class TestError extends Error {
  constructor(message) {
    super(message);
  }
}

const getDefaultVariableUtilsMock = (overwrites) => {
  const resolveVariableValues = {
    'self:custom.product': Promise.resolve('testProduct'),
    'stencil(account):domain': Promise.resolve('test.foo.bar'),
  };
  Object.assign(resolveVariableValues, overwrites);

  return {
    resolveVariable: (varialbleExpression) => {
      const potentiallyResolved = resolveVariableValues[varialbleExpression];
      if (potentiallyResolved === undefined) {
        return Promise.reject(new Error(`Unknown variable expression '${varialbleExpression}'.`));
      }

      return potentiallyResolved;
    },
    serviceDir: '/foo/bar/',
  };
};

const getDefaultSlsHelperMock = (overwrites, t) => {
  const slsHelperMock = {
    createAwsClient: (service) => {
      t.is(service, 'S3')
      return s3ClientMock;
    },
    region: 'foo-central-42',
  };
  return Object.assign(slsHelperMock, overwrites);
};

const s3ClientMock = {
  headBucket: () => {
    return {
      promise: () => Promise.resolve({}),
    };
  },
  getPublicAccessBlock: () => {
    return {
      promise: () => Promise.resolve({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      }),
    };
  },
};

const getDefaultLogUtilsMock = (overwrites) => {
  const logUtilsMock = {
    log: {
      warning: (message) => {
        // nothing
      },
    },
  };
  return Object.assign(logUtilsMock, overwrites);
};
