let deploymentPrefix = null;

module.exports.resolve = async ({serverless, variableUtils, slsHelper}) => {
  if (deploymentPrefix !== null) {
    return deploymentPrefix;
  }

  if (serverless.service.custom.component === undefined) {
    throw new serverless.classes.Error('To create deploymentPrefix you must provide `custom.component` property.');
  }

  const component = await variableUtils.resolveVariable('self:custom.component');

  deploymentPrefix = `${slsHelper.env}/${component}/serverless`;
  return deploymentPrefix;
};
