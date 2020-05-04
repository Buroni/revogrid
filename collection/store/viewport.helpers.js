import sortedIndex from 'lodash/sortedIndex';
import { range } from '../utils/utils';
/**
* Update items based on new scroll position
* If viewport wasn't changed fully simple recombination of positions
* Otherwise rebuild viewport items
*/
export function getUpdatedItemsByPosition(pos, items, realCount, virtualSize, dimension) {
    const activeItem = getOffset(dimension, pos, dimension.originItemSize);
    const firstItem = getFirstItem(items);
    let toUpdate;
    // do simple position replacement if items already present in viewport
    if (firstItem) {
        let changedOffsetStart = activeItem.itemIndex - (firstItem.itemIndex || 0);
        if (changedOffsetStart) {
            // try todo simple recombination
            const newData = recombineByOffset({
                newItem: activeItem,
                prevItem: firstItem,
                dimension: dimension,
                positiveDirection: changedOffsetStart > -1,
                offset: Math.abs(changedOffsetStart)
            }, items);
            if (newData) {
                toUpdate = newData;
            }
            // if partial replacement add items if revo-viewport has some space left
            if (toUpdate) {
                const extra = addMissingItems(activeItem, realCount, virtualSize, toUpdate, dimension);
                if (extra.items.length) {
                    toUpdate.items.push(...extra.items);
                    toUpdate.itemIndexes.push(...extra.itemIndexes);
                }
            }
        }
    }
    // new collection if no items after replacement full replacement
    if (!toUpdate) {
        toUpdate = getItems({
            sizes: dimension.sizes,
            start: activeItem.start,
            startIndex: activeItem.itemIndex,
            origSize: dimension.originItemSize,
            maxSize: virtualSize,
            maxCount: realCount
        });
    }
    return toUpdate;
}
// if partial replacement add items if revo-viewport has some space left
export function addMissingItems(firstItem, realCount, virtualSize, existingCollection, dimension) {
    const lastItem = getLastItem(existingCollection);
    const data = getItems({
        sizes: dimension.sizes,
        start: lastItem.end,
        startIndex: lastItem.itemIndex + 1,
        origSize: dimension.originItemSize,
        maxSize: virtualSize - (lastItem.end - firstItem.start),
        maxCount: realCount - lastItem.itemIndex
    });
    return {
        items: data.items,
        itemIndexes: range(data.items.length, existingCollection.items.length)
    };
}
// get first item in revo-viewport
function getOffset(dimension, pos, origSize) {
    const item = {
        itemIndex: 0,
        start: 0,
        end: 0
    };
    const currentPlace = dimension.indexes.length ? sortedIndex(dimension.positionIndexes, pos) : 0;
    // not found or first index
    if (!currentPlace) {
        item.itemIndex = Math.floor(pos / origSize);
        item.start = item.itemIndex * origSize;
        item.end = item.start + origSize;
        return item;
    }
    const positionItem = dimension.positionIndexToCoordinate[currentPlace - 1];
    // if item has specified size
    if (positionItem.end > pos) {
        return positionItem;
    }
    // special size item was present before
    const relativePos = pos - positionItem.end;
    const relativeIndex = Math.floor(relativePos / origSize);
    item.itemIndex = positionItem.itemIndex + 1 + relativeIndex;
    item.start = positionItem.end + relativeIndex * origSize;
    item.end = item.start + origSize;
    return item;
}
// get revo-viewport items parameters, caching position and calculating items count in revo-viewport
function getItems(opt, currentSize = 0) {
    const items = [];
    const itemIndexes = [];
    let index = opt.startIndex;
    let size = currentSize;
    let i = 0;
    while (size <= opt.maxSize && i < opt.maxCount) {
        const newSize = getItemSize(index, opt.sizes, opt.origSize);
        itemIndexes.push(i);
        items.push({
            start: opt.start + size,
            end: opt.start + size + newSize,
            itemIndex: index,
            size: newSize
        });
        size += newSize;
        index++;
        i++;
    }
    return { items, itemIndexes };
}
/**
* Do batch items recombination
* If items not overlapped with existing viewport returns null
*/
function recombineByOffset(data, state) {
    const indexSize = state.itemIndexes.length;
    // if offset out of revo-viewport, makes sense whole redraw
    if (data.offset > indexSize) {
        return null;
    }
    if (data.positiveDirection) {
        let lastItem = getLastItem(state);
        for (let i = 0; i < data.offset; i++) {
            const newIndex = lastItem.itemIndex + 1;
            const size = getItemSize(newIndex, data.dimension.sizes, data.dimension.originItemSize);
            // if item overlapped limit break a loop
            if (lastItem.end + size > data.dimension.realSize) {
                break;
            }
            state.items[state.itemIndexes[i]] = lastItem = {
                itemIndex: newIndex,
                start: lastItem.end,
                end: lastItem.end + size,
                size: size
            };
        }
        // push item to the end
        state.itemIndexes.push(...state.itemIndexes.splice(0, data.offset));
    }
    else {
        const changed = indexSize - data.offset;
        let firstItem = getFirstItem(state);
        for (let i = indexSize - 1; i >= changed; i--) {
            const newIndex = firstItem.itemIndex - 1;
            const size = getItemSize(newIndex, data.dimension.sizes, data.dimension.originItemSize);
            state.items[state.itemIndexes[i]] = firstItem = {
                itemIndex: newIndex,
                start: firstItem.start - size,
                end: firstItem.start,
                size: size
            };
        }
        // push item to the start
        state.itemIndexes.unshift(...state.itemIndexes.splice(changed, indexSize - 1));
    }
    return {
        items: [...state.items],
        itemIndexes: [...state.itemIndexes]
    };
}
function getItemSize(index, sizes, origSize) {
    if (sizes[index]) {
        return sizes[index];
    }
    return origSize;
}
function isActiveRange(pos, item) {
    return item && pos >= item.start && pos <= item.end;
}
function getFirstItem(s) {
    return s.items[s.itemIndexes[0]];
}
function getLastItem(s) {
    return s.items[s.itemIndexes[s.itemIndexes.length - 1]];
}
export { isActiveRange, getFirstItem, getLastItem };
