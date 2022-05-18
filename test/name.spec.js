const test = require('ava');

test.serial('should return bucket name if bucket exists and has correct configuration', async t => {
  const actual = await resolveName(t);
  t.is(actual, 'testProduct.foo-central-42.test.foo.bar');
});

test.serial('should throw serverless Error if custom.product is not set', async t => {
  const mockOverwrites = {
    serverlessOverwrites: {
      service: {
        custom: {},
      },
    },
  };

  const actual = t.throws(() => {
    resolveName(t, mockOverwrites);
  });
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
    service: {
      custom: {
        product: 'testProduct',
        component: 'testComponent',
      },
    },
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

const getDefaultVariableUtilsMock = () => {
  return {
    resolveVariable: (varialbleExpression) => {
      switch(varialbleExpression) {
        case 'self:custom.product': return Promise.resolve('testProduct');
        case 'stencil(account):domain': return Promise.resolve('test.foo.bar');
        defualt: throw Error(`Unknown variable expression '${varialbleExpression}'.`);
      }
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
