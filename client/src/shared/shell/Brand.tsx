/** علامة «wazlink» — رمز المدار ثلاثي النقاط بجانب الاسم، كما في `ideas.md`. */
import { appConfig } from "@config/env";

export function Brand() {
  return (
    <a className="brand" href="#/">
      <img src={`${appConfig.assetBaseUrl}wazlink-mark.svg`} alt="wazlink" />
      <span>
        <b>wazlink</b>
        <small>منصة مبيعات ذكية</small>
      </span>
    </a>
  );
}
