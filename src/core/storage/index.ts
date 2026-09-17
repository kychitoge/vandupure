import { StorageAdapter } from './storageAdapter.js';

export * from './storageAdapter.js';
export * from './configManager.js';

export const getSettings = StorageAdapter.getSettings.bind(StorageAdapter);
export const saveSettings = StorageAdapter.saveSettings.bind(StorageAdapter);
export const isSiteExcluded = StorageAdapter.isSiteExcluded.bind(StorageAdapter);
export const toggleCurrentSite = StorageAdapter.toggleCurrentSite.bind(StorageAdapter);
export const recordBlockedItem = StorageAdapter.recordBlockedItem.bind(StorageAdapter);
export const resetStats = StorageAdapter.resetStats.bind(StorageAdapter);
export const getHeaderProfiles = StorageAdapter.getHeaderProfiles.bind(StorageAdapter);
export const saveHeaderProfiles = StorageAdapter.saveHeaderProfiles.bind(StorageAdapter);
export const getActiveProfileId = StorageAdapter.getActiveProfileId.bind(StorageAdapter);
export const setActiveProfileId = StorageAdapter.setActiveProfileId.bind(StorageAdapter);
export const addHeaderProfile = StorageAdapter.addHeaderProfile.bind(StorageAdapter);
export const duplicateHeaderProfile = StorageAdapter.duplicateHeaderProfile.bind(StorageAdapter);
export const updateHeaderProfile = StorageAdapter.updateHeaderProfile.bind(StorageAdapter);
export const deleteHeaderProfile = StorageAdapter.deleteHeaderProfile.bind(StorageAdapter);
export const addCustomBlockDomain = StorageAdapter.addCustomBlockDomain.bind(StorageAdapter);
export const removeCustomBlockDomain = StorageAdapter.removeCustomBlockDomain.bind(StorageAdapter);
export const addCustomCosmeticSelector = StorageAdapter.addCustomCosmeticSelector.bind(StorageAdapter);
export const removeCustomCosmeticSelector = StorageAdapter.removeCustomCosmeticSelector.bind(StorageAdapter);
export const addExcludedSite = StorageAdapter.addExcludedSite.bind(StorageAdapter);
export const removeExcludedSite = StorageAdapter.removeExcludedSite.bind(StorageAdapter);
