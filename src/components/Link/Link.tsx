import { type FC, type JSX } from "react";
import {
  type LinkProps as NextLinkProps,
  default as NextLink,
} from "next/link";

import { classNames } from "@/css/classnames";

import "./Link.css";

export interface LinkProps
  extends NextLinkProps, Omit<JSX.IntrinsicElements["a"], "href"> {}

export const Link: FC<LinkProps> = ({ className, ...rest }) => {
  return <NextLink {...rest} className={classNames(className, "link")} />;
};
