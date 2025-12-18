import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProjectData {
  projectName: string;
  clientName: string;
  customerCode: string;
  date: string;
  location: string;
  drawingType: string;
  sheetType: string;
  modelType: string;
  dimSection1: string;
  dimSection2: string;
  dimSection3: string;
  dimSection4: string;
  dimSection5: string;
  length: string;
  width: string;
  height: string;
}

interface ProjectFormProps {
  projectData: ProjectData;
  setProjectData: (data: ProjectData | ((prev: ProjectData) => ProjectData)) => void;
  modelTypes?: Array<{
    model_type: string;
    title: string;
    preview_url?: string;
    glb_url?: string;
    has_model?: boolean;
    has_preview?: boolean;
  }>;
}

export const ProjectForm = ({ projectData, setProjectData, modelTypes = [] }: ProjectFormProps) => {
  const updateField = (field: keyof ProjectData, value: string) => {
    setProjectData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Information</CardTitle>
        <CardDescription>Enter project details and specifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={projectData.projectName}
              onChange={(e) => updateField('projectName', e.target.value)}
              placeholder="Enter project name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              value={projectData.clientName}
              onChange={(e) => updateField('clientName', e.target.value)}
              placeholder="Enter client name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerCode">Customer Code</Label>
            <Input
              id="customerCode"
              value={projectData.customerCode}
              onChange={(e) => updateField('customerCode', e.target.value)}
              placeholder="Enter customer code"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={projectData.date}
              onChange={(e) => updateField('date', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={projectData.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="Enter location"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="drawingType">Drawing Type</Label>
            <Select
              value={projectData.drawingType}
              onValueChange={(value) => updateField('drawingType', value)}
            >
              <SelectTrigger id="drawingType">
                <SelectValue placeholder="Select drawing type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shop_dwg">Shop DWG</SelectItem>
                <SelectItem value="production_dwg">Production DWG</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sheetType">Sheet Type</Label>
            <Select
              value={projectData.sheetType}
              onValueChange={(value) => updateField('sheetType', value)}
            >
              <SelectTrigger id="sheetType">
                <SelectValue placeholder="Select sheet type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sheet_202">Sheet 202</SelectItem>
                <SelectItem value="sheet_304">Sheet 304</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelType">Model Type</Label>
            <Select
              value={projectData.modelType}
              onValueChange={(value) => updateField('modelType', value)}
            >
              <SelectTrigger id="modelType">
                <SelectValue placeholder="Select model type" />
              </SelectTrigger>
              <SelectContent>
                {modelTypes.length > 0 ? (
                  modelTypes
                    .filter((modelType) => {
                      // Filter out invalid model types
                      if (!modelType.model_type || 
                          modelType.model_type.trim() === '' || 
                          !modelType.title || 
                          modelType.title.trim() === '') {
                        return false;
                      }
                      
                      // Filter out unwanted model types
                      const excludedTypes = ['wmss_single_skin_1_sec', 'one_collar_hole_single_skin', 'one_collar_single_skin'];
                      if (excludedTypes.includes(modelType.model_type)) {
                        return false;
                      }
                      
                      return true;
                    })
                    .map((modelType) => (
                      <SelectItem key={modelType.model_type} value={modelType.model_type}>
                        {modelType.title}
                      </SelectItem>
                    ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading model types...</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <Label htmlFor="dimSection1">Dim Section 1</Label>
            <Input
              id="dimSection1"
              value={projectData.dimSection1}
              onChange={(e) => updateField('dimSection1', e.target.value)}
              placeholder="Section 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dimSection2">Dim Section 2</Label>
            <Input
              id="dimSection2"
              value={projectData.dimSection2}
              onChange={(e) => updateField('dimSection2', e.target.value)}
              placeholder="Section 2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dimSection3">Dim Section 3</Label>
            <Input
              id="dimSection3"
              value={projectData.dimSection3}
              onChange={(e) => updateField('dimSection3', e.target.value)}
              placeholder="Section 3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dimSection4">Dim Section 4</Label>
            <Input
              id="dimSection4"
              value={projectData.dimSection4}
              onChange={(e) => updateField('dimSection4', e.target.value)}
              placeholder="Section 4"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dimSection5">Dim Section 5</Label>
            <Input
              id="dimSection5"
              value={projectData.dimSection5}
              onChange={(e) => updateField('dimSection5', e.target.value)}
              placeholder="Section 5"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
