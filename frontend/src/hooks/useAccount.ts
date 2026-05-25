import { useState, useCallback } from "react";
import {
  getAccountId,
  setAccountId,
  getRssUrl,
  setRssUrl,
  getOrder,
  setOrder,
  getEpisodes,
  setEpisodes,
  clearAccount,
} from "../lib/storage";
import type { Episode } from "../lib/types";

export function useAccount() {
  const [accountId, setAccountIdState] = useState(getAccountId);
  const [rssUrl, setRssUrlState] = useState(getRssUrl);
  const [episodes, setEpisodesState] = useState<Episode[]>(getEpisodes);
  const [order, setOrderState] = useState(getOrder);

  const createAccount = useCallback(() => {
    const id = "acc-" + crypto.randomUUID().slice(0, 8);
    setAccountId(id);
    setAccountIdState(id);
    return id;
  }, []);

  const joinAccount = useCallback((id: string) => {
    setAccountId(id);
    setAccountIdState(id);
  }, []);

  const logout = useCallback(() => {
    clearAccount();
    setAccountIdState("");
    setRssUrlState("");
    setEpisodesState([]);
    setOrderState("old-to-new");
  }, []);

  const updateRssUrl = useCallback((url: string) => {
    setRssUrl(url);
    setRssUrlState(url);
  }, []);

  const updateEpisodes = useCallback((eps: Episode[]) => {
    setEpisodes(eps);
    setEpisodesState(eps);
  }, []);

  const updateOrder = useCallback((o: string) => {
    setOrder(o);
    setOrderState(o);
  }, []);

  return {
    accountId,
    rssUrl,
    episodes,
    order,
    createAccount,
    joinAccount,
    logout,
    updateRssUrl,
    updateEpisodes,
    updateOrder,
  };
}