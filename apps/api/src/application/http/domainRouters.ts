import authRouter from "../../modules/auth/auth.routes";
import contentRouter from "../../modules/content/content.routes";
import tagRouter from "../../modules/tag/tag.routes";
import reviewRouter from "../../modules/review/review.routes";
import adminRouter from "../../modules/admin/admin.routes";
import analyticsRouter from "../../modules/analytics/analytics.routes";
import channelRouter from "../../modules/channel/channel.routes";
import templateRouter from "../../modules/template/template.routes";
import searchRouter from "../../modules/search/search.routes";
import componentRouter from "../../modules/component/component.routes";
import citationRouter from "../../modules/citation/citation.routes";
import profileRouter from "../../modules/profile/profile.routes";
import groupRouter from "../../modules/group/group.routes";

export const applicationDomainRouters = {
  auth: authRouter,
  content: contentRouter,
  tag: tagRouter,
  review: reviewRouter,
  admin: adminRouter,
  analytics: analyticsRouter,
  channel: channelRouter,
  template: templateRouter,
  search: searchRouter,
  component: componentRouter,
  citation: citationRouter,
  profile: profileRouter,
  group: groupRouter,
};
