/**
 * Mapping between the API's wire types (`@/api/types`) and the app's domain
 * models. The app uses string ids (the API's numeric id stringified), 0–6
 * weekday numbers (0 = Sun), and "HH:MM" times; the API uses numeric ids,
 * MON–SUN day codes, and "HH:mm:ss".
 *
 * Split by domain (member / routine-todo / room / house / shop-gacha /
 * notification); `@/api/adapters` re-exports everything, so consumers keep
 * importing from the barrel.
 */
export * from '@/api/adapters/member';
export * from '@/api/adapters/routine-todo';
export * from '@/api/adapters/room';
export * from '@/api/adapters/house';
export * from '@/api/adapters/shop-gacha';
export * from '@/api/adapters/notification';
