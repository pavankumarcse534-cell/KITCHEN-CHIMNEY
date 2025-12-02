import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Item {
  id: string;
  itemCode: string;
  model: string;
  modelType: string;
  length: string;
  width: string;
  height: string;
  exhaustCollarDM: string;
  exhaustCollarQty: string;
  filterItemCode: string;
  filterDimension: string;
  filterQty: string;
  filterLength: string;
  watts: string;
  cmhCfm: string;
  collarStaticPressure: string;
  freshAirQty: string;
  frontPanelThickness: string;
  skinType: string;
  make: string;
  uvLampCutout: string;
}

interface ItemTableProps {
  items: Item[];
  setItems: (items: Item[]) => void;
}

export const ItemTable = ({ items, setItems }: ItemTableProps) => {
  const addItem = () => {
    const newItem: Item = {
      id: Date.now().toString(),
      itemCode: '',
      model: '',
      modelType: '',
      length: '',
      width: '',
      height: '',
      exhaustCollarDM: '',
      exhaustCollarQty: '',
      filterItemCode: '',
      filterDimension: '',
      filterQty: '',
      filterLength: '',
      watts: '',
      cmhCfm: '',
      collarStaticPressure: '',
      freshAirQty: '',
      frontPanelThickness: '',
      skinType: '',
      make: '',
      uvLampCutout: '',
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof Item, value: string | boolean) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-foreground">Item Management</h2>
        <Button onClick={addItem} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {items.map((item, index) => (
            <Card key={item.id} className="p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Item {index + 1}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(item.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-start">
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">ITEMCODE</Label>
                <Input
                    placeholder="ITEMCODE"
                  value={item.itemCode}
                  onChange={(e) => updateItem(item.id, 'itemCode', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">SELECT MODEL</Label>
                  <Select
                    value={item.modelType || item.model || ''}
                    onValueChange={(value) => {
                      // Update both modelType and model fields when a model is selected
                      // This ensures the item is properly updated when any model type is clicked
                      updateItem(item.id, 'modelType', value);
                      updateItem(item.id, 'model', value);
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="SELECT MODEL" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WMSS">WMSS</SelectItem>
                      <SelectItem value="WMSP">WMSP</SelectItem>
                      <SelectItem value="WMDS">WMDS</SelectItem>
                      <SelectItem value="WMC">WMC</SelectItem>
                      <SelectItem value="UVC">UVC</SelectItem>
                      <SelectItem value="ISS">ISS</SelectItem>
                      <SelectItem value="ISP">ISP</SelectItem>
                      <SelectItem value="IDS">IDS</SelectItem>
                      <SelectItem value="IC">IC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">LENGTH</Label>
                <Input
                  type="number"
                    placeholder="LENGTH"
                  value={item.length}
                  onChange={(e) => updateItem(item.id, 'length', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">WIDTH</Label>
                <Input
                  type="number"
                    placeholder="WIDTH"
                  value={item.width}
                  onChange={(e) => updateItem(item.id, 'width', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">HEIGHT (MM)</Label>
                  <Select
                    value={item.height}
                    onValueChange={(value) => updateItem(item.id, 'height', value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="PICK HEIGHT" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="250">250 MM</SelectItem>
                      <SelectItem value="300">300 MM</SelectItem>
                      <SelectItem value="380">380 MM</SelectItem>
                      <SelectItem value="550">550 MM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">EXHAUST COLLAR DM</Label>
                  <Select
                    value={item.exhaustCollarDM}
                    onValueChange={(value) => updateItem(item.id, 'exhaustCollarDM', value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="SELECT DIMENSION" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="250*250">250*250</SelectItem>
                      <SelectItem value="300*250">300*250</SelectItem>
                      <SelectItem value="300*300">300*300</SelectItem>
                      <SelectItem value="330*300">330*300</SelectItem>
                      <SelectItem value="350*300">350*300</SelectItem>
                      <SelectItem value="380*300">380*300</SelectItem>
                      <SelectItem value="400*300">400*300</SelectItem>
                      <SelectItem value="430*300">430*300</SelectItem>
                      <SelectItem value="450*300">450*300</SelectItem>
                      <SelectItem value="480*300">480*300</SelectItem>
                      <SelectItem value="500*300">500*300</SelectItem>
                      <SelectItem value="530*300">530*300</SelectItem>
                      <SelectItem value="550*300">550*300</SelectItem>
                      <SelectItem value="580*300">580*300</SelectItem>
                      <SelectItem value="600*300">600*300</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">EXHAUST COLLAR QTY</Label>
                  <Select
                    value={item.exhaustCollarQty}
                    onValueChange={(value) => updateItem(item.id, 'exhaustCollarQty', value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="PICK QUANTITY" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">FILTER ITEM CODE</Label>
                <Input
                    placeholder="FILTER ITEM CODE"
                  value={item.filterItemCode}
                  onChange={(e) => updateItem(item.id, 'filterItemCode', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">FILTER DIMENSION</Label>
                <Input
                    placeholder="FILTER DIMENSION"
                  value={item.filterDimension}
                  onChange={(e) => updateItem(item.id, 'filterDimension', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">FILTER QTY</Label>
                <Input
                  type="number"
                    placeholder="FILTER QTY"
                  value={item.filterQty}
                  onChange={(e) => updateItem(item.id, 'filterQty', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">FILTER LENGTH</Label>
                <Input
                    placeholder="FILTER LENGTH"
                  value={item.filterLength}
                  onChange={(e) => updateItem(item.id, 'filterLength', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">WATTS</Label>
                <Input
                  type="number"
                    placeholder="WATTS"
                  value={item.watts}
                  onChange={(e) => updateItem(item.id, 'watts', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">CMH/CFM/COLLAR</Label>
                <Input
                  type="number"
                  placeholder="CMH/CFM/COLLAR"
                  value={item.cmhCfm}
                  onChange={(e) => updateItem(item.id, 'cmhCfm', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">COLLAR STATIC PRESSURE</Label>
                <Input
                  type="number"
                    placeholder="COLLAR STATIC PRESSURE"
                  value={item.collarStaticPressure}
                  onChange={(e) => updateItem(item.id, 'collarStaticPressure', e.target.value)}
                    className="h-10"
                />
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">FRESH AIR COLLAR DIM</Label>
                  <Select
                  value={item.freshAirQty}
                    onValueChange={(value) => updateItem(item.id, 'freshAirQty', value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="PICK DIMENSION" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="150*150">150*150</SelectItem>
                      <SelectItem value="350*200">350*200</SelectItem>
                      <SelectItem value="500*200">500*200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">FRONT PANEL THICKNESS</Label>
                  <Select
                    value={item.frontPanelThickness}
                    onValueChange={(value) => updateItem(item.id, 'frontPanelThickness', value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="SELECT THICKNESS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="1.2">1.2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">SKIN TYPE</Label>
                  <Select
                    value={item.skinType}
                    onValueChange={(value) => updateItem(item.id, 'skinType', value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="SELECT SKIN TYPE" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">SINGLE SKIN</SelectItem>
                      <SelectItem value="double">DOUBLE SKIN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">MAKE</Label>
                  <Select
                    value={item.make}
                    onValueChange={(value) => updateItem(item.id, 'make', value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="SELECT MAKE" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHILLIPS">PHILLIPS</SelectItem>
                      <SelectItem value="GO-LED">GO-LED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col h-full">
                  <Label className="text-xs text-muted-foreground">UV LAMP CUTOUT</Label>
                  <Select
                    value={item.uvLampCutout}
                    onValueChange={(value) => updateItem(item.id, 'uvLampCutout', value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="SELECT CUTOUT" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="610">610</SelectItem>
                      <SelectItem value="842">842</SelectItem>
                      <SelectItem value="1200">1200</SelectItem>
                      <SelectItem value="1554">1554</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          ))}

          {items.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No items added yet. Click "Add Item" to get started.
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
